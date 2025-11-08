import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import pmRoutes from './routes/pm.routes.js';
import timesheetRoutes from './routes/timesheet.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import financeRoutes from './routes/finance.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import aiRoutes from './routes/ai.routes.js';
import profileRoutes from './routes/profile.routes.js';
import { notFound, errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
// Static hosting for uploaded receipts (for preview)
app.use('/uploads', express.static(path.resolve('uploads')));

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/pm', pmRoutes);
app.use('/timesheets', timesheetRoutes);
app.use('/expenses', expenseRoutes);
app.use('/finance', financeRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/ai', aiRoutes);
app.use('/profile', profileRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'FlowIQ Auth API' });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`Auth server running on port ${PORT}`));
  });
}

export default app;
