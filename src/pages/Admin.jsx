import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import styles from './Admin.module.css';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
const AVATAR_SEEDS = ['Felix', 'Milo', 'Luna', 'Cleo', 'Leo', 'Bella', 'Simba', 'Lucy', 'Max', 'Chloe'];
const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

export function Admin() {
    const { users, fetchUsers, currentUser, t } = useProject();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('users'); // 'users', 'invite', 'teams', 'roles'

    const [teams, setTeams] = useState([]);
    const [roles, setRoles] = useState([]);

    useEffect(() => {
        const fetchHierarchyData = async () => {
            if (!currentUser) return;
            try {
                const headers = { 'x-user-id': currentUser.id };
                // Fetch Teams (for admin and team_manager)
                if (currentUser.role === 'admin' || currentUser.role === 'team_manager') {
                    const teamsRes = await axios.get('http://localhost:3000/api/admin/teams', { headers });
                    if (teamsRes.data.success) setTeams(teamsRes.data.teams);
                }
                // Fetch Roles (only admin)
                if (currentUser.role === 'admin') {
                    const rolesRes = await axios.get('http://localhost:3000/api/admin/roles', { headers });
                    if (rolesRes.data.success) setRoles(rolesRes.data.roles);
                }
            } catch (err) {
                console.error('Failed to fetch hierarchy data', err);
            }
        };
        fetchHierarchyData();
    }, [currentUser]);

    // Single Invite State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('member');

    // Bulk Invite State
    const [csvFile, setCsvFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [bulkResults, setBulkResults] = useState(null);

    // Direct Add State
    const [directName, setDirectName] = useState('');
    const [directEmail, setDirectEmail] = useState('');
    const [directPassword, setDirectPassword] = useState('');
    const [directRole, setDirectRole] = useState('member');
    const [directTeamId, setDirectTeamId] = useState('');
    const [directAvatarNode, setDirectAvatarNode] = useState(AVATAR_SEEDS[0]);

    // Edit User Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [changePassword, setChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Teams & Roles Forms State
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleDesc, setNewRoleDesc] = useState('');

    const handleDownloadTemplate = () => {
        const csvContent = "email,role\nuser1@example.com,member\nuser2@example.com,admin\n";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'taskboard_invite_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDirectAdd = async (e) => {
        e.preventDefault();
        if (!directName || !directEmail || !directPassword) return;
        try {
            const res = await axios.post('http://localhost:3000/api/admin/users/direct', {
                name: directName,
                email: directEmail,
                password: directPassword,
                role: directRole,
                team_id: directTeamId || (teams.length > 0 ? teams[0].id : 1),
                avatar: getAvatarUrl(directAvatarNode)
            }, {
                headers: { 'x-user-id': currentUser.id }
            });
            if (res.data.success) {
                showToast(t('admin.successful') || 'User created directly!', 'success');
                setDirectName('');
                setDirectEmail('');
                setDirectPassword('');
                setDirectAvatarNode(AVATAR_SEEDS[0]);
                fetchUsers(); // Instantly update UI without page reload
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to create user', 'error');
        }
    };

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'team_manager') {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.crumbs}>
                        <Link to="/">← {t('common.back_to_dashboard') || 'Back'}</Link>
                    </div>
                    <h1>{t('admin.access_denied')}</h1>
                </header>
                <div className={styles.section}>
                    <p>{t('admin.no_permission')}</p>
                </div>
            </div>
        );
    }

    const handleSingleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return;
        try {
            const res = await axios.post('http://localhost:3000/api/admin/invite', {
                email: inviteEmail,
                role: inviteRole
            }, {
                headers: { 'x-user-id': currentUser.id }
            });
            if (res.data.success) {
                showToast('Invitation sent successfully!', 'success');
                setInviteEmail('');
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to send invite', 'error');
        }
    };

    const handleBulkInvite = async (e) => {
        e.preventDefault();
        if (!csvFile) return;
        setIsUploading(true);
        setBulkResults(null);

        const formData = new FormData();
        formData.append('file', csvFile);

        try {
            const res = await axios.post('http://localhost:3000/api/admin/invite/bulk', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'x-user-id': currentUser.id
                }
            });
            if (res.data.success) {
                setBulkResults(res.data.results);
                showToast('Bulk upload processed', 'success');
                setCsvFile(null);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to process CSV', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddTeam = async (e) => {
        e.preventDefault();
        if (!newTeamName) return;
        try {
            const res = await axios.post('http://localhost:3000/api/admin/teams', { name: newTeamName, description: newTeamDesc }, { headers: { 'x-user-id': currentUser.id } });
            if (res.data.success) {
                showToast('Team added successfully', 'success');
                setTeams([...teams, res.data.team]);
                setNewTeamName('');
                setNewTeamDesc('');
            }
        } catch (error) { showToast(error.response?.data?.message || 'Failed to add team', 'error'); }
    };

    const handleDeleteTeam = async (id) => {
        if (!window.confirm('Delete this team?')) return;
        try {
            const res = await axios.delete(`http://localhost:3000/api/admin/teams/${id}`, { headers: { 'x-user-id': currentUser.id } });
            if (res.data.success) {
                showToast('Team deleted', 'success');
                setTeams(teams.filter(t => t.id !== id));
            }
        } catch (error) { showToast(error.response?.data?.message || 'Failed to delete team', 'error'); }
    };

    const handleAddRole = async (e) => {
        e.preventDefault();
        if (!newRoleName) return;
        try {
            const res = await axios.post('http://localhost:3000/api/admin/roles', { name: newRoleName, description: newRoleDesc }, { headers: { 'x-user-id': currentUser.id } });
            if (res.data.success) {
                showToast('Role added successfully', 'success');
                setRoles([...roles, res.data.role]);
                setNewRoleName('');
                setNewRoleDesc('');
            }
        } catch (error) { showToast(error.response?.data?.message || 'Failed to add role', 'error'); }
    };

    const handleDeleteRole = async (id) => {
        if (!window.confirm('Delete this role?')) return;
        try {
            const res = await axios.delete(`http://localhost:3000/api/admin/roles/${id}`, { headers: { 'x-user-id': currentUser.id } });
            if (res.data.success) {
                showToast('Role deleted', 'success');
                setRoles(roles.filter(r => r.id !== id));
            }
        } catch (error) { showToast(error.response?.data?.message || 'Failed to delete role', 'error'); }
    };

    const handleRowClick = (user) => {
        setEditingUser(user);
        setChangePassword(false);
        setNewPassword('');
        setConfirmPassword('');
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();

        if (changePassword && newPassword !== confirmPassword) {
            showToast(t('admin.passwordMismatch') || 'Passwords do not match', 'error');
            return;
        }

        try {
            const payload = {
                name: editingUser.name,
                email: editingUser.username,
                role: editingUser.role,
                team_id: editingUser.team_id,
                avatar: editingUser.avatar
            };

            if (changePassword && newPassword) {
                payload.password = newPassword;
            }

            const res = await axios.put(`http://localhost:3000/api/users/${editingUser.id}`, payload, {
                headers: { 'x-user-id': currentUser.id }
            });

            if (res.data.success) {
                showToast(t('admin.saveSuccess') || 'User updated successfully!', 'success');
                setIsEditModalOpen(false);
                setEditingUser(null);
                fetchUsers(); // Instantly update UI without page reload
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to update user', 'error');
        }
    };

    const handleDeleteUser = async (e, id) => {
        e.stopPropagation(); // Prevent row click from firing
        if (!window.confirm(t('admin.confirmDeleteUser') || 'Are you sure you want to delete this user?')) return;
        try {
            const res = await axios.delete(`http://localhost:3000/api/users/${id}`, {
                headers: { 'x-user-id': currentUser.id }
            });
            if (res.data.success) {
                showToast(t('admin.success') || 'User deleted successfully', 'success');
                fetchUsers(); // Instantly update UI instead of forcing reload
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to delete user', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.crumbs}>
                    <Link to="/">← {t('common.back_to_dashboard')}</Link>
                </div>
                <h1>{t('auth.admin_panel')}</h1>
            </header>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    {t('admin.allUsers')}
                </button>
                {currentUser?.role === 'admin' && (
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'invite' ? styles.tabBtnActive : ''}`}
                        onClick={() => setActiveTab('invite')}
                    >
                        {t('admin.inviteUsers')}
                    </button>
                )}
                {(currentUser?.role === 'admin' || currentUser?.role === 'team_manager') && (
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'teams' ? styles.tabBtnActive : ''}`}
                        onClick={() => setActiveTab('teams')}
                    >
                        {t('admin.manageTeams') || 'Teams'}
                    </button>
                )}
                {(currentUser?.role === 'admin' || currentUser?.role === 'team_manager') && (
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'roles' ? styles.tabBtnActive : ''}`}
                        onClick={() => setActiveTab('roles')}
                    >
                        {t('admin.manageRoles') || 'Roles'}
                    </button>
                )}
            </div>

            {
                activeTab === 'users' && (
                    <div className={styles.section}>
                        <h2>{t('admin.allUsers')}</h2>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{t('admin.col_avatar') || 'Avatar'}</th>
                                    <th>{t('admin.col_name') || 'Name'}</th>
                                    <th>{t('admin.col_role') || 'Role'}</th>
                                    <th>{t('admin.col_id') || 'ID'}</th>
                                    <th>{t('admin.col_action') || 'Action'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className={styles.clickableRow} onClick={() => handleRowClick(user)}>
                                        <td><img src={user.avatar} className={styles.avatarSmall} alt="avatar" /></td>
                                        <td>{user.name}</td>
                                        <td><span className={`${styles.badge} ${styles[user.role]}`}>{user.role === 'admin' ? t('admin.roleAdmin') : (user.role === 'team_manager' ? 'Team Manager' : t('admin.roleMember'))}</span></td>
                                        <td className={styles.mono}>{user.id}</td>
                                        <td>
                                            {user.id !== currentUser.id && (
                                                <button
                                                    onClick={(e) => handleDeleteUser(e, user.id)}
                                                    className={styles.secondaryBtn}
                                                >
                                                    {t('admin.delete') || 'Delete'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {
                activeTab === 'invite' && (
                    <>
                        <div className={styles.section}>
                            <h2>{t('admin.sendSingleInvite')}</h2>
                            <form onSubmit={handleSingleInvite} className={styles.form}>
                                <input
                                    type="email"
                                    placeholder={t('admin.emailAddress')}
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    required
                                />
                                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                    <option value="member">{t('admin.roleMember')}</option>
                                    <option value="admin">{t('admin.roleAdmin')}</option>
                                </select>
                                <button type="submit" className={styles.primaryBtn}>{t('admin.sendInvite')}</button>
                            </form>
                        </div>

                        <div className={styles.section}>
                            <h2>{t('admin.directAddUser')}</h2>
                            <form onSubmit={handleDirectAdd} className={styles.verticalForm}>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.fullName')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('admin.fullName')}
                                        value={directName}
                                        onChange={e => setDirectName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.emailAddress')}</label>
                                    <input
                                        type="email"
                                        placeholder={t('admin.emailAddress')}
                                        value={directEmail}
                                        onChange={e => setDirectEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.passwordPlaceholder')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('admin.passwordPlaceholder')}
                                        value={directPassword}
                                        onChange={e => setDirectPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.col_role') || 'Role'}</label>
                                    <select value={directRole} onChange={e => setDirectRole(e.target.value)}>
                                        {roles.filter(r => {
                                            if (currentUser?.role === 'admin') return true;
                                            return r.name !== 'admin' && r.name !== 'team_manager';
                                        }).map(r => (
                                            <option key={r.id} value={r.name}>{r.name === 'admin' ? t('admin.roleAdmin') : (r.name === 'member' ? t('admin.roleMember') : r.name)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Team</label>
                                    <select value={directTeamId} onChange={e => setDirectTeamId(e.target.value)}>
                                        <option value="">Select Team</option>
                                        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.selectAvatar') || 'Select Avatar'}</label>
                                    <div className={styles.avatarGrid}>
                                        {AVATAR_SEEDS.map(seed => (
                                            <img
                                                key={seed}
                                                src={getAvatarUrl(seed)}
                                                alt={seed}
                                                className={`${styles.avatarItem} ${directAvatarNode === seed ? styles.avatarItemSelected : ''}`}
                                                onClick={() => setDirectAvatarNode(seed)}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" className={styles.primaryBtn}>{t('admin.createUser')}</button>
                            </form>
                        </div>

                        <div className={styles.section}>
                            <h2>{t('admin.bulkInviteCsv')}</h2>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <p className={styles.mono} style={{ margin: 0 }}>{t('admin.csvFormatGuide')}</p>
                                <button onClick={handleDownloadTemplate} type="button" className={styles.tabBtn} style={{ border: '1px solid var(--color-border)' }}>
                                    ↓ {t('admin.downloadSampleDb')}
                                </button>
                            </div>
                            <form onSubmit={handleBulkInvite}>
                                <div className={styles.uploadArea}>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => setCsvFile(e.target.files[0])}
                                    />
                                    <button type="submit" className={styles.primaryBtn} disabled={!csvFile || isUploading}>
                                        {isUploading ? t('admin.processing') : t('admin.uploadAndSend')}
                                    </button>
                                </div>
                            </form>

                            {bulkResults && (
                                <div className={styles.resultsArea}>
                                    <h3>{t('admin.results')}:</h3>
                                    <p className={styles.successText}>{t('admin.successful')}: {bulkResults.successful}</p>
                                    <p className={styles.errorText}>{t('admin.failed')}: {bulkResults.failed}</p>
                                    {bulkResults.errors && bulkResults.errors.length > 0 && (
                                        <ul style={{ marginTop: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                                            {bulkResults.errors.map((err, idx) => (
                                                <li key={idx} className={styles.errorText}>{err}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )
            }

            {
                activeTab === 'teams' && (currentUser?.role === 'admin' || currentUser?.role === 'team_manager') && (
                    <div className={styles.section}>
                        <h2>{t('admin.manageTeams') || 'Manage Teams'}</h2>
                        <form onSubmit={handleAddTeam} className={styles.form} style={{ marginBottom: '1rem' }}>
                            <input type="text" placeholder={t('admin.teamName') || 'Team Name'} value={newTeamName} onChange={e => setNewTeamName(e.target.value)} required />
                            <input type="text" placeholder={t('admin.teamDesc') || 'Description'} value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} />
                            <button type="submit" className={styles.primaryBtn}>{t('admin.addTeam') || 'Add Team'}</button>
                        </form>
                        <table className={styles.table}>
                            <thead><tr><th>ID</th><th>{t('admin.teamName') || 'Name'}</th><th>{t('admin.teamDesc') || 'Description'}</th><th>{t('admin.col_action') || 'Action'}</th></tr></thead>
                            <tbody>
                                {teams.map(team => (
                                    <tr key={team.id}>
                                        <td className={styles.mono}>{team.id}</td><td>{team.name}</td><td>{team.description}</td>
                                        <td><button type="button" onClick={() => handleDeleteTeam(team.id)} className={styles.secondaryBtn}>{t('admin.delete') || 'Delete'}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {
                activeTab === 'roles' && (currentUser?.role === 'admin' || currentUser?.role === 'team_manager') && (
                    <div className={styles.section}>
                        <h2>{t('admin.manageRoles') || 'Manage Roles'}</h2>
                        <form onSubmit={handleAddRole} className={styles.form} style={{ marginBottom: '1rem' }}>
                            <input type="text" placeholder={t('admin.roleName') || 'Role Name'} value={newRoleName} onChange={e => setNewRoleName(e.target.value)} required />
                            <input type="text" placeholder={t('admin.roleDesc') || 'Description'} value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} />
                            <button type="submit" className={styles.primaryBtn}>{t('admin.addRole') || 'Add Role'}</button>
                        </form>
                        <table className={styles.table}>
                            <thead><tr><th>ID</th><th>{t('admin.roleName') || 'Name'}</th><th>{t('admin.roleDesc') || 'Description'}</th><th>{t('admin.col_action') || 'Action'}</th></tr></thead>
                            <tbody>
                                {roles.map(role => (
                                    <tr key={role.id}>
                                        <td className={styles.mono}>{role.id}</td><td>{role.name}</td><td>{role.description}</td>
                                        <td><button type="button" onClick={() => handleDeleteRole(role.id)} className={styles.secondaryBtn}>{t('admin.delete') || 'Delete'}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {isEditModalOpen && editingUser && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>{t('admin.editUser') || 'Edit User Info'}</h3>
                            <button className={styles.closeBtn} onClick={() => setIsEditModalOpen(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <form id="editUserForm" onSubmit={handleUpdateUser} className={styles.verticalForm}>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.fullName') || 'Name'}</label>
                                    <input
                                        type="text"
                                        value={editingUser.name || ''}
                                        onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.emailAddress') || 'Email'}</label>
                                    <input
                                        type="email"
                                        value={editingUser.username || ''}
                                        onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.col_role') || 'Role'}</label>
                                    <select
                                        value={editingUser.role}
                                        onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                                        disabled={currentUser?.role !== 'admin' && currentUser?.role !== 'team_manager'}
                                    >
                                        {roles.filter(r => {
                                            if (currentUser?.role === 'admin') return true;
                                            return r.name !== 'admin' && r.name !== 'team_manager';
                                        }).map(r => (
                                            <option key={r.id} value={r.name}>{r.name === 'admin' ? t('admin.roleAdmin') : (r.name === 'member' ? t('admin.roleMember') : r.name)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Team</label>
                                    <select
                                        value={editingUser.team_id || ''}
                                        onChange={e => setEditingUser({ ...editingUser, team_id: e.target.value })}
                                        disabled={currentUser?.role !== 'admin'}
                                    >
                                        <option value="">Select Team</option>
                                        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>{t('admin.selectAvatar') || 'Select Profile Avatar'}</label>
                                    <div className={styles.avatarGrid}>
                                        {AVATAR_SEEDS.map(seed => {
                                            const url = getAvatarUrl(seed);
                                            const isSelected = editingUser.avatar === url;
                                            return (
                                                <img
                                                    key={seed}
                                                    src={url}
                                                    alt={seed}
                                                    className={`${styles.avatarItem} ${isSelected ? styles.avatarItemSelected : ''}`}
                                                    onClick={() => setEditingUser({ ...editingUser, avatar: url })}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '1rem', fontWeight: 'bold' }}>
                                        <input
                                            type="checkbox"
                                            checked={changePassword}
                                            onChange={(e) => setChangePassword(e.target.checked)}
                                            style={{ marginRight: '0.5rem', width: 'auto' }}
                                        />
                                        {t('admin.changePassword') || 'Change Password'}
                                    </label>
                                </div>
                                {changePassword && (
                                    <>
                                        <div className={styles.formGroup}>
                                            <label>{t('admin.newPassword') || 'New Password'}</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                required={changePassword}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>{t('admin.confirmPassword') || 'Confirm Password'}</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                required={changePassword}
                                            />
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>
                        <div className={styles.modalFooter}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => setIsEditModalOpen(false)}>
                                {t('admin.cancel') || 'Cancel'}
                            </button>
                            <button type="submit" form="editUserForm" className={styles.primaryBtn}>
                                {t('admin.saveChanges') || 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
