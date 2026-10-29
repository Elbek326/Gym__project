import { loadAnalytics, pAnalytics } from './analytics.js';
import { loadAudit, pAudit, renderAuditList } from './audit.js';
import { loadDashboard, pDashboard } from './dashboard.js';
import { loadFinance, pFinance } from './finance.js';
import { loadMember, loadMyProfile, pMember, pMyProfile } from './member.js';
import { loadMembers, pMembers, renderMemberList } from './members.js';
import { pPassword } from './password.js';
import { loadRankings, pRankings } from './rankings.js';
import { pSettings } from './settings.js';
import { loadShop, pShop } from './shop.js';
import { loadUsers, pUsers } from './users.js';

/* acc = who may open the page: 'staff' (default), 'admin', 'member' (a signed-in member only) or 'any' */
export const PAGES = {
  dashboard: { title: 'Dashboard', icon: 'dashboard', load: loadDashboard, render: pDashboard },
  profile: { title: 'My Profile', icon: 'user', load: loadMyProfile, render: pMyProfile, acc: 'member' },
  members: { title: 'Members', icon: 'users', load: loadMembers, render: pMembers, after: renderMemberList },
  member: { title: 'Member', load: loadMember, render: pMember, parent: 'members' },
  shop: { title: 'Shop', icon: 'bag', load: loadShop, render: pShop },
  finance: { title: 'Finance', icon: 'wallet', load: loadFinance, render: pFinance },
  analytics: { title: 'Analytics', icon: 'chart', load: loadAnalytics, render: pAnalytics },
  rankings: { title: 'Rankings', icon: 'trophy', load: loadRankings, render: pRankings, acc: 'any' },
  audit: { title: 'Audit Log', icon: 'log', load: loadAudit, render: pAudit, after: renderAuditList },
  users: { title: 'User Roles', icon: 'shield', load: loadUsers, render: pUsers, acc: 'admin' },
  password: { title: 'My Password', icon: 'key', render: pPassword, acc: 'any' },
  settings: { title: 'Settings', icon: 'gear', render: pSettings, acc: 'any' }
};
