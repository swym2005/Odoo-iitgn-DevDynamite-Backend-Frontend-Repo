import express from 'express';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { myProjects, myTasks, createMyTask, listProjectTasks, assignSelf, updateMyTask } from '../controllers/team.controller.js';

const router = express.Router();
router.use(requireAuth);

router.get('/projects', myProjects);
router.get('/tasks', myTasks);
// Creation requires membership (enforced by requireProjectAccess)
router.post('/projects/:projectId/tasks', requireProjectAccess, createMyTask);
// View all tasks in a project (membership required)
router.get('/projects/:projectId/tasks', requireProjectAccess, listProjectTasks);
// Self-assign to an unassigned task within a project
router.patch('/projects/:projectId/tasks/:taskId/assign-self', requireProjectAccess, assignSelf);
// Update task (status, description, etc.) - Team Members can update tasks they're assigned to or tasks in their projects
router.patch('/projects/:projectId/tasks/:taskId', requireProjectAccess, updateMyTask);

export default router;
