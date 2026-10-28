import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { GYM, prepareHashes, fresh, signOut, addMemberUser, ADMIN_PW, MEMBER_PW, auditActions, mkMember, timePlan } from './_helpers.js';

beforeAll(prepareHashes);
beforeEach(() => fresh({ signedIn: false }));

describe('password hashing', () => {
  it('produces a salted pbkdf2_sha256 string that verifies only the right password', async () => {
    const h1 = await GYM.hashPassword('s3cret');
    const h2 = await GYM.hashPassword('s3cret');
    expect(h1).toMatch(/^pbkdf2_sha256\$150000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain('s3cret');
    expect(await GYM.verifyPassword('s3cret', h1)).toBe(true);
    expect(await GYM.verifyPassword('S3cret', h1)).toBe(false);
  });
  it('a stored value that is not a hash never verifies', async () => {
    expect(await GYM.verifyPassword('admin123', 'admin123')).toBe(false);
    expect(await GYM.verifyPassword('', undefined)).toBe(false);
  });
  it('migratePasswords hashes plain-text passwords once', async () => {
    GYM.S().users.u_old = { id: 'u_old', username: 'old', password: 'plain1', role: 'admin' };
    expect(await GYM.migratePasswords()).toBe(1);   /* the seeded admin is already hashed */
    expect(GYM.S().users.u_old.password).toMatch(/^pbkdf2_sha256\$/);
    expect(await GYM.verifyPassword('plain1', GYM.S().users.u_old.password)).toBe(true);
    expect(await GYM.migratePasswords()).toBe(0);
  });
  it('ensureDefaultAdmin creates admin/admin123 only in an empty database', async () => {
    GYM.loadState({});
    expect(await GYM.ensureDefaultAdmin()).toBe(true);
    const u = GYM.values('users');
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ id: 'u_admin', username: 'admin', role: 'admin' });
    expect(await GYM.verifyPassword('admin123', u[0].password)).toBe(true);
    expect(await GYM.ensureDefaultAdmin()).toBe(false);
  });
});

describe('login / logout', () => {
  it('signs in case-insensitively and trims the username', async () => {
    const u = await GYM.login('  ADMIN ', ADMIN_PW);
    expect(u.id).toBe('u_admin');
    expect(GYM.me().id).toBe('u_admin');
    expect(auditActions()).toContain('LOGIN');
  });
  it('wrong password and unknown user give the same message and are audited', async () => {
    await expect(GYM.login('admin', 'nope')).rejects.toThrow('Wrong username or password.');
    await expect(GYM.login('ghost', 'nope')).rejects.toThrow('Wrong username or password.');
    expect(GYM.me()).toBe(null);
    expect(auditActions().filter((a) => a === 'LOGIN_FAILED')).toHaveLength(2);
  });
  it('read-only mode: login works but writes no audit row', async () => {
    GYM.Store.readOnly = true;
    await GYM.login('admin', ADMIN_PW);
    expect(GYM.values('audit')).toHaveLength(0);
  });
  it('logout clears the session', async () => {
    await GYM.login('admin', ADMIN_PW);
    GYM.logout();
    expect(GYM.me()).toBe(null);
    expect(auditActions()).toContain('LOGOUT');
  });
  it('a member can sign in; one whose profile is gone cannot; a removed role cannot', async () => {
    GYM.restoreSession('u_admin');
    const c = await mkMember('Ali');
    GYM.logout();
    addMemberUser(c.id, 'ali');
    const u = await GYM.login('ali', MEMBER_PW);
    expect(u.role).toBe('member');
    GYM.logout();
    delete GYM.S().clients[c.id];
    await expect(GYM.login('ali', MEMBER_PW)).rejects.toThrow('This account is no longer linked to a member. Ask an admin.');
    GYM.S().users.u_owner = Object.assign({}, GYM.S().users.u_admin, { id: 'u_owner', username: 'owner', role: 'owner' });
    await expect(GYM.login('owner', ADMIN_PW)).rejects.toThrow('This role no longer exists. Ask an admin.');
    expect(GYM.me()).toBe(null);
  });
});

describe('changeOwnPassword', () => {
  beforeEach(() => { GYM.restoreSession('u_admin'); });

  it('requires a signed-in user', async () => {
    signOut();
    await expect(GYM.changeOwnPassword(ADMIN_PW, 'newpw1', 'newpw1')).rejects.toThrow('Please sign in first.');
  });
  it('rejects a wrong current password, a short or mismatching new one', async () => {
    await expect(GYM.changeOwnPassword('wrong', 'newpw1', 'newpw1')).rejects.toThrow('Current password is wrong.');
    await expect(GYM.changeOwnPassword(ADMIN_PW, 'abc', 'abc')).rejects.toThrow('New password must be at least 4 characters.');
    await expect(GYM.changeOwnPassword(ADMIN_PW, 'newpw1', 'newpw2')).rejects.toThrow('The new passwords do not match.');
    expect(await GYM.verifyPassword(ADMIN_PW, GYM.S().users.u_admin.password)).toBe(true);
  });
  it('changes the password and audits it without the password', async () => {
    await GYM.changeOwnPassword(ADMIN_PW, 'newpw1', 'newpw1');
    const h = GYM.S().users.u_admin.password;
    expect(await GYM.verifyPassword('newpw1', h)).toBe(true);
    expect(await GYM.verifyPassword(ADMIN_PW, h)).toBe(false);
    expect(GYM.values('audit').find((a) => a.action === 'PASSWORD_CHANGED').detail).toBe('admin');
  });
});

describe('user management', () => {
  beforeEach(() => { GYM.restoreSession('u_admin'); });

  it('addUser validates username format, uniqueness (case-insensitive), password and role', async () => {
    await expect(GYM.addUser({ username: 'a', password: 'abcd', role: 'admin' })).rejects.toThrow('Username: 3 to 30 letters, digits, dots, dashes or underscores.');
    await expect(GYM.addUser({ username: 'bad name', password: 'abcd', role: 'admin' })).rejects.toThrow('Username: 3 to 30');
    await expect(GYM.addUser({ username: 'ADMIN', password: 'abcd', role: 'admin' })).rejects.toThrow('That username is taken.');
    await expect(GYM.addUser({ username: 'boss', password: 'abc', role: 'admin' })).rejects.toThrow('Password must be at least 4 characters.');
    await expect(GYM.addUser({ username: 'boss', password: 'abcd', role: 'trainer' })).rejects.toThrow('Choose a valid role.');
    await expect(GYM.addUser({ username: 'boss', password: 'abcd', role: 'member' })).rejects.toThrow('Choose a valid role.');
    expect(GYM.values('users')).toHaveLength(1);
  });
  it('addUser creates an admin whose password is hashed; listUsers hides member logins', async () => {
    const u = await GYM.addUser({ username: 'Boss', password: 'abcd', role: 'admin' });
    expect(u.password).toMatch(/^pbkdf2_sha256\$/);
    addMemberUser('c1', 'zed');
    expect(GYM.listUsers().map((x) => x.username)).toEqual(['admin', 'Boss'].sort((a, b) => a.localeCompare(b)));
  });
  it('an admin cannot delete themselves; another admin can be deleted', async () => {
    const b = await GYM.addUser({ username: 'boss', password: 'abcd', role: 'admin' });
    expect(() => GYM.deleteUser('u_admin')).toThrow('You cannot delete your own account.');
    GYM.deleteUser(b.id);
    expect(GYM.values('users')).toHaveLength(1);
    expect(() => GYM.deleteUser(b.id)).toThrow('User not found.');
  });
  it('the last admin cannot be demoted (the only other role is "member", which is not assignable)', () => {
    expect(() => GYM.setRole('u_admin', 'member')).toThrow('Choose a valid role.');
    expect(() => GYM.setRole('u_admin', 'trainer')).toThrow('Choose a valid role.');
    expect(GYM.S().users.u_admin.role).toBe('admin');
    expect(() => GYM.setRole('nope', 'admin')).toThrow('User not found.');
  });
  it('member logins cannot be managed from the user list', () => {
    const id = addMemberUser('c1', 'zed');
    expect(() => GYM.deleteUser(id)).toThrow('User not found.');
    expect(() => GYM.setRole(id, 'admin')).toThrow('User not found.');
  });
  it('resetPassword sets a new hash', async () => {
    const b = await GYM.addUser({ username: 'boss', password: 'abcd', role: 'admin' });
    await expect(GYM.resetPassword(b.id, 'xy')).rejects.toThrow('Password must be at least 4 characters.');
    await GYM.resetPassword(b.id, 'newpass');
    expect(await GYM.verifyPassword('newpass', GYM.S().users[b.id].password)).toBe(true);
    await expect(GYM.resetPassword('nope', 'newpass')).rejects.toThrow('User not found.');
  });
});

describe('member login creation (createClient)', () => {
  beforeEach(() => { GYM.restoreSession('u_admin'); });

  it('creates a hashed member account linked to the new member', async () => {
    const c = await GYM.createClient({ name: 'Ali', login: ' ali.k ', password: 'pass1234' });
    const u = GYM.values('users').find((x) => x.role === 'member');
    expect(u).toMatchObject({ username: 'ali.k', client: c.id });
    expect(u.password).toMatch(/^pbkdf2_sha256\$/);
    expect(JSON.stringify(GYM.values('audit'))).not.toContain('pass1234');
    expect(GYM.memberLogin(c.id).username).toBe('ali.k');
    expect(JSON.stringify(GYM.memberLogin(c.id))).not.toContain('pbkdf2');
    expect(auditActions()).toContain('MEMBER_LOGIN_CREATED');
  });
  it('the new member can sign in', async () => {
    await GYM.createClient({ name: 'Ali', login: 'ali', password: 'pass1234' });
    GYM.logout();
    const u = await GYM.login('ALI', 'pass1234');
    expect(u.role).toBe('member');
  });
  it('requires login and password together', async () => {
    await expect(GYM.createClient({ name: 'A', login: 'alik' })).rejects.toThrow('Password is required to create a login.');
    await expect(GYM.createClient({ name: 'A', password: 'pass1234' })).rejects.toThrow('Login is required when a password is set.');
    await expect(GYM.createClient({ name: 'A', login: 'alik', password: 'abc' })).rejects.toThrow('Password must be at least 4 characters.');
    expect(GYM.values('clients')).toHaveLength(0);
  });
  it('usernames are unique across ALL users, ignoring case', async () => {
    await expect(GYM.createClient({ name: 'A', login: 'Admin', password: 'pass1234' })).rejects.toThrow('That username is taken.');
    await GYM.createClient({ name: 'A', login: 'Ali', password: 'pass1234' });
    await expect(GYM.createClient({ name: 'B', login: 'aLi', password: 'pass1234' })).rejects.toThrow('That username is taken.');
    expect(GYM.values('clients')).toHaveLength(1);
    await expect(GYM.addUser({ username: 'ALI', password: 'abcd', role: 'admin' })).rejects.toThrow('That username is taken.');
  });
  it('rejects a bad username format', async () => {
    await expect(GYM.createClient({ name: 'A', login: 'a b', password: 'pass1234' })).rejects.toThrow('Username: 3 to 30');
  });
});
