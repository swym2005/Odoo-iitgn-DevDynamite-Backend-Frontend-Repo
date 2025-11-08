import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';

export const myProjects = async (req, res, next) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const projects = await Project.find({ teamMembers: uid })
      .select('name client status budget deadline manager teamMembers')
      .lean();
    res.json({ success: true, projects });
  } catch (e) { next(e); }
};

export const myTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({ assignee: req.user.id }).populate('project','name status manager teamMembers').lean();
    res.json({ success: true, tasks });
  } catch (e) { next(e); }
};

export const createMyTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    // Project access already enforced by middleware; still verify membership for defense-in-depth
    const project = await Project.findOne({ _id: projectId, teamMembers: req.user.id });
    if (!project) { const err = new Error('Forbidden'); err.status = 403; throw err; }
    const { title, description, priority = 'medium', dueDate } = req.body;
    if(!title){ const err = new Error('Title is required'); err.status = 400; throw err; }
    const created = await Task.create({ title, description, priority, dueDate, project: projectId, assignee: req.user.id, status: 'todo' });
    res.status(201).json({ success: true, task: created });
  } catch (e) { next(e); }
};

export const listProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    // Membership enforced by middleware
    const tasks = await Task.find({ project: projectId }).populate('assignee','name email').lean();
    res.json({ success: true, tasks });
  } catch (e) { next(e); }
};

export const assignSelf = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    // Ensure user is member of the project
    const project = await Project.findOne({ _id: projectId, teamMembers: req.user.id });
    if(!project){ const err=new Error('Forbidden'); err.status=403; throw err; }
    const task = await Task.findOne({ _id: taskId, project: projectId });
    if(!task){ const err=new Error('Task not found'); err.status=404; throw err; }
    if(task.assignee){ return res.status(409).json({ success:false, message:'Task already assigned' }); }
    task.assignee = req.user.id;
    task.activity.push({ user: req.user.id, type: 'assignment', meta: { assignee: req.user.id } });
    await task.save();
    res.json({ success:true, task });
  } catch(e){ next(e); }
};
