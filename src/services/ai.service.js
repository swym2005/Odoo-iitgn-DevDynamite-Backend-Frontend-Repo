import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { VendorBill } from '../models/VendorBill.js';
import { Expense } from '../models/Expense.js';
import { Timesheet } from '../models/Timesheet.js';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { overviewAnalytics, projectAnalytics } from './analytics.service.js';
import mongoose from 'mongoose';

// Placeholder Gemini integration wrapper (user can plug real SDK later)
const callGemini = async (prompt, system = 'You are FlowIQ AI assistant.') => {
  if (!process.env.GEMINI_API_KEY) {
    return `*(Simulated AI)* ${prompt.substring(0,120)}...`; // fallback stub
  }
  // Real implementation would call Google AI Studio (Gemini) REST API here.
  return `Gemini response for: ${prompt.substring(0,120)}...`; // simplified stub
};

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

export const chatRespond = async (user, { message, from, to, project, role }) => {
  // Provide lightweight context summary to model
  const filters = { from, to, project, role };
  const basePrompt = `User role: ${user.role}. Query: "${message}". Filters: ${JSON.stringify(filters)}.`;
  const aiText = await callGemini(basePrompt);
  return { markdown: aiText, meta: { filters } };
};

export const insight = async (user, { type, from, to, project, role }) => {
  const filters = { from, to, project, role };
  switch (type) {
    case 'top_profitable': {
      // Profit per project = paid invoice revenue - (paid bills + approved expenses)
      const matchRev = { status: 'Paid', ...(project ? { project: toObjectId(project) } : {}), ...(from || to ? dateClause('date', from, to) : {}) };
      const matchBills = { status: 'Paid', ...(project ? { project: toObjectId(project) } : {}), ...(from || to ? dateClause('date', from, to) : {}) };
      const matchExp = { status: 'approved', ...(project ? { project: toObjectId(project) } : {}), ...(from || to ? dateClause('createdAt', from, to) : {}) };
      const [revAgg, billsAgg, expAgg, projects] = await Promise.all([
        CustomerInvoice.aggregate([{ $match: matchRev }, { $group: { _id: '$project', revenue: { $sum: '$amount' } } }]),
        VendorBill.aggregate([{ $match: matchBills }, { $group: { _id: '$project', billsCost: { $sum: '$amount' } } }]),
        Expense.aggregate([{ $match: matchExp }, { $group: { _id: '$project', expCost: { $sum: '$amount' } } }]),
        Project.find(project ? { _id: project } : {}).select('name').lean(),
      ]);
      const costMap = new Map();
      for (const b of billsAgg) costMap.set(String(b._id), (costMap.get(String(b._id)) || 0) + b.billsCost);
      for (const e of expAgg) costMap.set(String(e._id), (costMap.get(String(e._id)) || 0) + e.expCost);
      const revMap = new Map(revAgg.map(r => [String(r._id), r.revenue]));
      const projName = new Map(projects.map(p => [String(p._id), p.name]));
      const rows = [];
      for (const id of new Set([...revMap.keys(), ...costMap.keys()])) {
        const revenue = revMap.get(id) || 0;
        const cost = costMap.get(id) || 0;
        const profit = revenue - cost;
        const margin = revenue ? profit / revenue : 0;
        rows.push({ projectId: id, name: projName.get(id) || 'Unknown', revenue, cost, profit, margin });
      }
      rows.sort((a,b) => b.profit - a.profit);
      return { type, markdown: formatProjectsTable(rows.slice(0,10), 'Top Profitable Projects'), data: rows.slice(0,10) };
    }
    case 'cost_overruns': {
      // Cost over budget: cost (paid bills + approved expenses) - project budget
      const matchBills = { status: 'Paid', ...(project ? { project: toObjectId(project) } : {}), ...(from || to ? dateClause('date', from, to) : {}) };
      const matchExp = { status: 'approved', ...(project ? { project: toObjectId(project) } : {}), ...(from || to ? dateClause('createdAt', from, to) : {}) };
      const [billsAgg, expAgg, projects] = await Promise.all([
        VendorBill.aggregate([{ $match: matchBills }, { $group: { _id: '$project', billsCost: { $sum: '$amount' } } }]),
        Expense.aggregate([{ $match: matchExp }, { $group: { _id: '$project', expCost: { $sum: '$amount' } } }]),
        Project.find(project ? { _id: project } : {}).select('name budget').lean(),
      ]);
      const costMap = new Map();
      for (const b of billsAgg) costMap.set(String(b._id), (costMap.get(String(b._id)) || 0) + b.billsCost);
      for (const e of expAgg) costMap.set(String(e._id), (costMap.get(String(e._id)) || 0) + e.expCost);
      const rows = [];
      for (const p of projects) {
        const cost = costMap.get(String(p._id)) || 0;
        const overrun = cost - (p.budget || 0);
        const overPct = p.budget ? Math.max(0, overrun) / p.budget : 0;
        rows.push({ projectId: p._id, name: p.name, budget: p.budget || 0, cost, overrun: Math.max(0, overrun), overrunPercent: overPct });
      }
      rows.sort((a,b) => b.overrun - a.overrun);
      return { type, markdown: formatCostOverruns(rows.slice(0,10)), data: rows.slice(0,10) };
    }
    case 'team_utilization': {
      const matchTs = { ...(project ? { project: toObjectId(project) } : {}), ...(from || to ? dateClause('date', from, to) : {}) };
      const utilAgg = await Timesheet.aggregate([
        { $match: matchTs },
        { $group: { _id: '$user', hours: { $sum: '$hours' } } },
        { $sort: { hours: -1 } },
      ]);
      const rows = utilAgg.map(u => ({ userId: u._id, hours: u.hours, utilization: Math.min(1, u.hours / 160) }));
      return { type, markdown: formatUtilization(rows), data: rows };
    }
    case 'project_summary': {
      if (!project) throw new Error('project parameter required for project_summary');
      const analytics = await projectAnalytics(user, project, { from, to });
      const proj = await Project.findById(project).select('name budget').lean();
      const summaryMd = formatProjectSummary(proj?.name || 'Project', proj?.budget || 0, analytics);
      return { type, markdown: summaryMd, data: analytics };
    }
    default:
      return { type, markdown: 'Unsupported insight type', data: null };
  }
};

export const generateReport = async (user, { type, from, to, project, role }) => {
  if (type === 'overview') {
    const data = await overviewAnalytics(user, { from, to, project, role });
    return { type, markdown: reportMarkdownOverview(data) };
  }
  if (type === 'project') {
    if (!project) throw new Error('project required for project report');
    const data = await projectAnalytics(user, project, { from, to });
    return { type, markdown: reportMarkdownProject(data) };
  }
  throw new Error('Unsupported report type');
};

// Helpers
const dateClause = (field, from, to) => {
  const m = {};
  if (from) m.$gte = new Date(from);
  if (to) m.$lte = new Date(to);
  return Object.keys(m).length ? { [field]: m } : {};
};

const formatProjectsTable = (rows, title) => {
  const header = `## ${title}\n\n| Project | Revenue | Cost | Profit | Margin |\n|---------|---------:|------:|--------:|-------:|`;
  const body = rows.map(r => `| ${r.name} | ${r.revenue.toFixed(2)} | ${r.cost.toFixed(2)} | ${(r.profit).toFixed(2)} | ${(r.margin*100).toFixed(1)}% |`).join('\n');
  return `${header}\n${body}`;
};

const formatCostOverruns = (rows) => {
  const header = `## Cost Overruns\n\n| Project | Budget | Cost | Overrun | Overrun % |\n|---------|-------:|-----:|--------:|----------:|`;
  const body = rows.map(r => `| ${r.name} | ${r.budget.toFixed(2)} | ${r.cost.toFixed(2)} | ${r.overrun.toFixed(2)} | ${(r.overrunPercent*100).toFixed(1)}% |`).join('\n');
  return `${header}\n${body}`;
};

const formatUtilization = (rows) => {
  const header = `## Team Utilization\n\n| User ID | Hours | Utilization % |\n|---------|------:|--------------:|`;
  const body = rows.map(r => `| ${r.userId} | ${r.hours.toFixed(2)} | ${(r.utilization*100).toFixed(1)}% |`).join('\n');
  return `${header}\n${body}`;
};

const formatProjectSummary = (name, budget, analytics) => {
  const completionPct = (analytics.completion*100).toFixed(1);
  const revCost = analytics.revenueVsCost.reduce((acc,r)=>{acc.revenue+=r.revenue;acc.cost+=r.cost;return acc;},{revenue:0,cost:0});
  const profit = revCost.revenue - revCost.cost;
  return `# ${name} Summary\n\n**Budget:** ${budget.toFixed(2)}\n\n**Completion:** ${completionPct}%\n\n**Cumulative Revenue:** ${revCost.revenue.toFixed(2)}\n**Cumulative Cost:** ${revCost.cost.toFixed(2)}\n**Cumulative Profit:** ${profit.toFixed(2)}\n\n## Timeline\n${analytics.timeline.map(t=>`- ${t.label}: Created ${t.created}, Done ${t.done}`).join('\n')}\n\n## Revenue vs Cost (Monthly)\n| Month | Revenue | Cost |\n|-------|--------:|-----:|\n${analytics.revenueVsCost.map(r=>`| ${r.label} | ${r.revenue.toFixed(2)} | ${r.cost.toFixed(2)} |`).join('\n')}`;
};

const reportMarkdownOverview = (data) => {
  return `# Overview Report\n\n**Total Revenue:** ${data.kpis.totalRevenue.toFixed(2)}\n\n**Avg Profit Margin:** ${(data.kpis.avgProfitMargin*100).toFixed(2)}%\n**Hours Logged:** ${data.kpis.hoursLogged}\n**Expense Ratio:** ${(data.kpis.expenseRatio*100).toFixed(2)}%\n\n## Cost vs Revenue\n| Project | Revenue | Cost |\n|---------|--------:|-----:|\n${data.charts.costVsRevenue.map(r=>`| ${r.projectName} | ${r.revenue.toFixed(2)} | ${r.cost.toFixed(2)} |`).join('\n')}\n\n## Revenue Growth\n| Month | Revenue |\n|-------|--------:|\n${data.charts.revenueGrowth.map(r=>`| ${r.label} | ${r.revenue.toFixed(2)} |`).join('\n')}\n`;
};

const reportMarkdownProject = (data) => {
  const revCost = data.revenueVsCost.reduce((acc,r)=>{acc.revenue+=r.revenue;acc.cost+=r.cost;return acc;},{revenue:0,cost:0});
  const profit = revCost.revenue - revCost.cost;
  return `# Project Report\n\n**Completion:** ${(data.completion*100).toFixed(2)}%\n**Cumulative Revenue:** ${revCost.revenue.toFixed(2)}\n**Cumulative Cost:** ${revCost.cost.toFixed(2)}\n**Cumulative Profit:** ${profit.toFixed(2)}\n\n## Timeline\n| Month | Created | Done |\n|-------|--------:|-----:|\n${data.timeline.map(r=>`| ${r.label} | ${r.created} | ${r.done} |`).join('\n')}\n\n## Revenue vs Cost\n| Month | Revenue | Cost |\n|-------|--------:|-----:|\n${data.revenueVsCost.map(r=>`| ${r.label} | ${r.revenue.toFixed(2)} | ${r.cost.toFixed(2)} |`).join('\n')}`;
};
