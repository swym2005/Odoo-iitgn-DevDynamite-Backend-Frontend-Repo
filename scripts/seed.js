#!/usr/bin/env node
// Seed script: creates demo users, projects, tasks, timesheets, finance docs, expenses, notifications.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { Timesheet } from '../src/models/Timesheet.js';
import { Expense } from '../src/models/Expense.js';
import { CustomerInvoice } from '../src/models/CustomerInvoice.js';
import { VendorBill } from '../src/models/VendorBill.js';
import { SalesOrder } from '../src/models/SalesOrder.js';
import { PurchaseOrder } from '../src/models/PurchaseOrder.js';
import { Notification } from '../src/models/Notification.js';
import { Roles } from '../src/utils/roles.js';

dotenv.config({ path: process.env.ENV_PATH || '.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/orbitone_demo';

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function daysFromNow(d){ const dt = new Date(); dt.setDate(dt.getDate()+d); return dt; }

async function main(){
  await mongoose.connect(MONGO_URI);
  console.log('Connected to mongo');

  const wipe = process.argv.includes('--reset');
  if(wipe){
    await Promise.all([
      User.deleteMany({}), Project.deleteMany({}), Task.deleteMany({}), Timesheet.deleteMany({}),
      Expense.deleteMany({}), CustomerInvoice.deleteMany({}), VendorBill.deleteMany({}),
      SalesOrder.deleteMany({}), PurchaseOrder.deleteMany({}), Notification.deleteMany({})
    ]);
    console.log('Collections cleared');
  }

  // Create users
  const existing = await User.findOne({ email: 'admin@example.com' });
  if(existing){ console.log('Seed data already exists. Use --reset to wipe.'); process.exit(0); }

  const users = await User.insertMany([
    { name:'Alice Admin', email:'admin@example.com', password:'Password123', role:Roles.Admin, hourlyRate: 0 },
    { name:'Pam PM', email:'pm@example.com', password:'Password123', role:Roles.ProjectManager, hourlyRate: 0 },
    { name:'Tina Team', email:'team1@example.com', password:'Password123', role:Roles.TeamMember, hourlyRate: 55 },
    { name:'Tom Team', email:'team2@example.com', password:'Password123', role:Roles.TeamMember, hourlyRate: 60 },
    { name:'Frank Finance', email:'finance@example.com', password:'Password123', role:Roles.Finance, hourlyRate: 0 },
  ]);
  const byEmail = Object.fromEntries(users.map(u=>[u.email,u]));
  console.log('Users created');

  // Projects
  const projects = await Project.insertMany([
    { name:'Apollo Revamp', description:'Rebuild client portal', client:'Acme Corp', budget: 120000, manager: byEmail['pm@example.com']._id, teamMembers:[byEmail['team1@example.com']._id, byEmail['team2@example.com']._id], status:'active', startDate: daysFromNow(-30), deadline: daysFromNow(45) },
    { name:'Orion Mobile', description:'iOS + Android app', client:'Globex', budget: 80000, manager: byEmail['pm@example.com']._id, teamMembers:[byEmail['team1@example.com']._id], status:'active', startDate: daysFromNow(-10), deadline: daysFromNow(60) },
    { name:'Nova Research', description:'R&D spike', client:'Internal', budget: 30000, manager: byEmail['pm@example.com']._id, teamMembers:[byEmail['team2@example.com']._id], status:'planning', startDate: daysFromNow(-5), deadline: daysFromNow(25) },
  ]);
  console.log('Projects created');

  // Tasks
  const priorities = ['low','medium','high','critical'];
  const statuses = ['todo','in-progress','review','blocked','done'];
  const taskData = [];
  projects.forEach(p=>{
    for(let i=1;i<=8;i++){
      taskData.push({
        project: p._id,
        title: `${p.name.split(' ')[0]} Task ${i}`,
        description: 'Lorem ipsum placeholder task description '+i,
        assignee: rand([byEmail['team1@example.com']._id, byEmail['team2@example.com']._id, null]),
        priority: rand(priorities),
        status: rand(statuses),
        dueDate: daysFromNow(rand([-5,2,5,10,15,20])),
        order: i,
      });
    }
  });
  const tasks = await Task.insertMany(taskData);
  console.log('Tasks created:', tasks.length);

  // Timesheets (random subset)
  const tsPayload = [];
  tasks.slice(0,15).forEach(t=>{
    tsPayload.push({ project: t.project, task: t._id, user: t.assignee || byEmail['team1@example.com']._id, hours: (Math.random()*6+1).toFixed(1), billable: true, date: daysFromNow(rand([-3,-2,-1,0])) });
  });
  await Timesheet.insertMany(tsPayload);
  console.log('Timesheets created:', tsPayload.length);

  // Expenses
  const expenses = await Expense.insertMany([
    { project: projects[0]._id, description:'AWS bill', amount: 850, billable:true, submittedBy: byEmail['team1@example.com']._id, status:'approved' },
    { project: projects[0]._id, description:'Design assets', amount: 1200, billable:true, submittedBy: byEmail['team2@example.com']._id, status:'pending' },
    { project: projects[1]._id, description:'Test devices', amount: 650, billable:false, submittedBy: byEmail['team1@example.com']._id, status:'approved' },
  ]);
  console.log('Expenses created:', expenses.length);

  // Sales Orders / Purchase Orders / Invoices / Vendor Bills with line items
  const so = await SalesOrder.create({ number:'SO-1001', customer:'Acme Corp', project: projects[0]._id, amount:0, lineItems:[{ description:'Implementation Sprint 1', quantity:10, unitPrice:150, taxRate:0.18 },{ description:'Implementation Sprint 2', quantity:8, unitPrice:150, taxRate:0.18 }] });
  const po = await PurchaseOrder.create({ number:'PO-9001', vendor:'Hardware Hub', project: projects[0]._id, amount:0, lineItems:[{ description:'MacBook Pro', quantity:2, unitPrice:2400, taxRate:0.05 }] });
  const inv = await CustomerInvoice.create({ number:'INV-5001', customer:'Acme Corp', project: projects[0]._id, amount:0, lineItems:[{ description:'Development Retainer', quantity:1, unitPrice:20000, taxRate:0.18 }, { description:'Extra Features', quantity:15, unitPrice:140, taxRate:0.18 }], status:'Paid' });
  const bill = await VendorBill.create({ number:'BILL-7001', vendor:'CloudProvider', project: projects[0]._id, amount:0, lineItems:[{ description:'Compute Hours', quantity:300, unitPrice:0.25, taxRate:0.18 }], status:'Paid' });
  console.log('Finance docs created');

  // Notifications
  await Notification.insertMany([
    { user: byEmail['team1@example.com']._id, type:'task', title:'Task Assigned', message:'You were assigned a new task', link:'/tasks?project='+projects[0]._id },
    { audienceRole: Roles.TeamMember, type:'system', title:'Timesheet Reminder', message:'Don\'t forget to submit your hours', link:'/timesheets-ui/' },
  ]);
  console.log('Notifications created');

  console.log('\nSeed complete. Admin login: admin@example.com / Password123');
  console.log('PM login: pm@example.com / Password123');
  console.log('Team logins: team1@example.com, team2@example.com / Password123');
  console.log('Finance login: finance@example.com / Password123');
  await mongoose.disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
