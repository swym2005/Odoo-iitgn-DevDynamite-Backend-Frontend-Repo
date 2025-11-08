export const Roles = {
  Admin: 'Admin',
  ProjectManager: 'Project Manager',
  TeamMember: 'Team Member',
  Finance: 'Finance',
  Vendor: 'Vendor',
};

export const roleRedirect = {
  [Roles.Admin]: '/admin-dashboard',
  [Roles.ProjectManager]: '/pm-dashboard',
  [Roles.TeamMember]: '/team-dashboard',
  [Roles.Finance]: '/finance-dashboard',
  [Roles.Vendor]: '/vendor-dashboard',
};
