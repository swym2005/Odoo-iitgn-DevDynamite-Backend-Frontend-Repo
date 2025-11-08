import { Roles } from '../utils/roles.js';

export const getMenuForRole = (role) => {
  const base = [
    { key: 'home', label: 'Home', path: '/', icon: 'home' },
    { key: 'profile', label: 'Profile', path: '/profile', icon: 'user' },
  ];

  const admin = [
    { key: 'admin-dashboard', label: 'Admin', path: '/admin/dashboard', icon: 'shield' },
    { key: 'users', label: 'Users', path: '/admin/users', icon: 'users' },
    { key: 'analytics', label: 'Analytics', path: '/analytics', icon: 'chart' },
  ];
  const pm = [
    { key: 'pm-dashboard', label: 'Projects', path: '/pm/dashboard', icon: 'project' },
    { key: 'timesheets', label: 'Timesheets', path: '/timesheets', icon: 'clock' },
    { key: 'expenses', label: 'Expenses', path: '/expenses', icon: 'receipt' },
  ];
  const finance = [
    { key: 'finance', label: 'Finance', path: '/finance', icon: 'bank' },
    { key: 'invoices', label: 'Invoices', path: '/finance/invoices', icon: 'invoice' },
    { key: 'bills', label: 'Vendor Bills', path: '/finance/bills', icon: 'bill' },
  ];
  const team = [
    { key: 'team-projects', label: 'My Work', path: '/team/projects', icon: 'tasks' },
    { key: 'timesheets', label: 'Timesheets', path: '/timesheets', icon: 'clock' },
    { key: 'expenses', label: 'Expenses', path: '/expenses', icon: 'receipt' },
  ];
  const vendor = [
    { key: 'vendor', label: 'Vendor', path: '/vendor/dashboard', icon: 'package' },
  ];

  switch (role) {
    case Roles.Admin:
      return [...base, ...admin, ...pm, ...finance];
    case Roles.ProjectManager:
      return [...base, ...pm, { key: 'analytics', label: 'Analytics', path: '/analytics', icon: 'chart' }];
    case Roles.Finance:
      return [...base, ...finance, { key: 'analytics', label: 'Analytics', path: '/analytics', icon: 'chart' }];
    case Roles.TeamMember:
      return [...base, ...team];
    case Roles.Vendor:
      return [...base, ...vendor];
    default:
      return base;
  }
};
