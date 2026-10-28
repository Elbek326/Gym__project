import { pAnalytics } from './analytics.js';
import { pAudit, renderAuditList } from './audit.js';
import { pDashboard } from './dashboard.js';
import { pFinance } from './finance.js';
import { pMember, pMyProfile } from './member.js';
import { pMembers, renderMemberList } from './members.js';
import { pPassword } from './password.js';
import { pRankings } from './rankings.js';
import { pSettings } from './settings.js';
import { pShop } from './shop.js';
import { pUsers } from './users.js';

/* acc = who may open the page: 'staff' (default), 'admin', 'member' (a signed-in member only) or 'any' */
export const PAGES = {
  dashboard: { title: 'Dashboard', icon: 'dashboard', render: pDashboard },
  profile: { title: 'My Profile', icon: 'user', render: pMyProfile, acc: 'member' },
  members: { title: 'Members', icon: 'users', render: pMembers, after: renderMemberList },
  member: { title: 'Member', render: pMember, parent: 'members' },
  shop: { title: 'Shop', icon: 'bag', render: pShop },
  finance: { title: 'Finance', icon: 'wallet', render: pFinance },
  analytics: { title: 'Analytics', icon: 'chart', render: pAnalytics },
  rankings: { title: 'Rankings', icon: 'trophy', render: pRankings, acc: 'any' },
  audit: { title: 'Audit Log', icon: 'log', render: pAudit, after: renderAuditList },
  users: { title: 'User Roles', icon: 'shield', render: pUsers, acc: 'admin' },
  password: { title: 'My Password', icon: 'key', render: pPassword, acc: 'any' },
  settings: { title: 'Settings', icon: 'gear', render: pSettings, acc: 'any' }
};
