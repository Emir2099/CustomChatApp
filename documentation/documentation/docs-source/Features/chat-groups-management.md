---
sidebar_position: 17
---

# Chat Groups Management

Implementing robust group chat functionality was a priority feature for this application. I wanted to create a flexible system that would support both casual and professional use cases with proper admin controls.

## Group Creation and Configuration

I built a streamlined UI for creating and configuring chat groups:

```jsx
// src/components/groups/CreateGroupModal.jsx
function CreateGroupModal({ isOpen, onClose }) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { createGroup } = useGroups();
  const { currentUser } = useAuth();
  const { users } = useUsers();
  
  // Filter out the current user from available users
  const availableUsers = useMemo(() => {
    return Object.values(users).filter(user => user.uid !== currentUser?.uid);
  }, [users, currentUser]);
  
  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };
  
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Please enter a group name");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Add current user as member and admin
      const members = {
        [currentUser.uid]: {
          role: 'admin',
          joinedAt: Date.now()
        }
      };
      
      // Add selected users as members
      selectedUsers.forEach(userId => {
        members[userId] = {
          role: 'member',
          joinedAt: Date.now()
        };
      });
      
      await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim(),
        isPublic,
        createdBy: currentUser.uid,
        createdAt: Date.now(),
        members
      });
      
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      setError("Failed to create group. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={styles.modalContent}>
        <h2>Create New Group</h2>
        
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        <div className={styles.formGroup}>
          <label htmlFor="groupName">Group Name</label>
          <input
            id="groupName"
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name"
            className={styles.input}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="groupDescription">Description (optional)</label>
          <textarea
            id="groupDescription"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            placeholder="Enter group description"
            className={styles.textarea}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={() => setIsPublic(!isPublic)}
              className={styles.checkbox}
            />
            Make this group public (anyone can join)
          </label>
        </div>
        
        <div className={styles.userSelectionSection}>
          <h3>Add Members</h3>
          <div className={styles.userList}>
            {availableUsers.length === 0 ? (
              <div className={styles.emptyState}>No users available</div>
            ) : (
              availableUsers.map(user => (
                <div 
                  key={user.uid}
                  className={`
                    ${styles.userItem} 
                    ${selectedUsers.includes(user.uid) ? styles.selected : ''}
                  `}
                  onClick={() => handleUserSelect(user.uid)}
                >
                  <UserAvatar userId={user.uid} size="small" />
                  <span>{user.displayName}</span>
                  
                  {selectedUsers.includes(user.uid) && (
                    <CheckIcon className={styles.checkIcon} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className={styles.modalActions}>
          <button 
            onClick={onClose} 
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancel
          </button>
          
          <button 
            onClick={handleCreateGroup} 
            className={styles.createButton}
            disabled={isLoading || !groupName.trim()}
          >
            {isLoading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

## Group Management Context

To manage group operations throughout the app, I created a dedicated context:

```jsx
// src/contexts/GroupsContext.jsx
const GroupsContext = createContext();

export function GroupsProvider({ children }) {
  const [groups, setGroups] = useState({});
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { currentUser } = useAuth();
  
  // Load user's groups
  useEffect(() => {
    if (!currentUser) {
      setGroups({});
      setUserGroups([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    const userGroupsRef = ref(db, `userGroups/${currentUser.uid}`);
    
    const handleUserGroups = async (snapshot) => {
      if (!snapshot.exists()) {
        setUserGroups([]);
        setGroups({});
        setLoading(false);
        return;
      }
      
      const userGroupsData = snapshot.val();
      const groupIds = Object.keys(userGroupsData);
      
      setUserGroups(groupIds);
      
      // Fetch detailed group data
      const groupsData = {};
      
      for (const groupId of groupIds) {
        try {
          const groupSnapshot = await get(ref(db, `groups/${groupId}`));
          
          if (groupSnapshot.exists()) {
            groupsData[groupId] = {
              id: groupId,
              ...groupSnapshot.val()
            };
          }
        } catch (err) {
          console.error(`Error loading group ${groupId}:`, err);
        }
      }
      
      setGroups(groupsData);
      setLoading(false);
    };
    
    onValue(userGroupsRef, handleUserGroups);
    
    return () => off(userGroupsRef);
  }, [currentUser]);
  
  // Create a new group
  const createGroup = async (groupData) => {
    if (!currentUser) throw new Error("You must be signed in");
    
    // Create group in database
    const groupsRef = ref(db, 'groups');
    const newGroupRef = push(groupsRef);
    const groupId = newGroupRef.key;
    
    await set(newGroupRef, groupData);
    
    // Add group to each member's groups list
    const memberUpdates = {};
    
    Object.keys(groupData.members).forEach(userId => {
      memberUpdates[`userGroups/${userId}/${groupId}`] = true;
    });
    
    await update(ref(db), memberUpdates);
    
    // Create a chat for the group
    const chatRef = ref(db, `chats/${groupId}`);
    
    await set(chatRef, {
      name: groupData.name,
      isGroup: true,
      createdAt: groupData.createdAt,
      createdBy: groupData.createdBy,
      participants: Object.keys(groupData.members).reduce((acc, userId) => {
        acc[userId] = {
          joinedAt: groupData.members[userId].joinedAt
        };
        return acc;
      }, {})
    });
    
    return groupId;
  };
  
  // Join a group
  const joinGroup = async (groupId) => {
    if (!currentUser) throw new Error("You must be signed in");
    if (!groupId) throw new Error("Group ID is required");
    
    // Get group data to verify if it's public
    const groupRef = ref(db, `groups/${groupId}`);
    const groupSnapshot = await get(groupRef);
    
    if (!groupSnapshot.exists()) {
      throw new Error("Group not found");
    }
    
    const groupData = groupSnapshot.val();
    
    if (!groupData.isPublic) {
      throw new Error("This group is private. You need an invitation to join.");
    }
    
    // Add user to group
    const updates = {
      [`groups/${groupId}/members/${currentUser.uid}`]: {
        role: 'member',
        joinedAt: Date.now()
      },
      [`userGroups/${currentUser.uid}/${groupId}`]: true,
      [`chats/${groupId}/participants/${currentUser.uid}`]: {
        joinedAt: Date.now()
      }
    };
    
    await update(ref(db), updates);
    
    // Add system message about user joining
    const messagesRef = ref(db, `messages/${groupId}`);
    const newMessageRef = push(messagesRef);
    
    await set(newMessageRef, {
      type: 'system',
      content: `${currentUser.displayName} joined the group`,
      timestamp: Date.now()
    });
    
    return groupId;
  };
  
  // Leave group
  const leaveGroup = async (groupId) => {
    if (!currentUser) throw new Error("You must be signed in");
    
    // Check if user is the last admin
    const groupRef = ref(db, `groups/${groupId}`);
    const groupSnapshot = await get(groupRef);
    
    if (!groupSnapshot.exists()) {
      throw new Error("Group not found");
    }
    
    const groupData = groupSnapshot.val();
    
    // Count admins
    let adminCount = 0;
    let isUserAdmin = false;
    
    Object.entries(groupData.members || {}).forEach(([userId, memberData]) => {
      if (memberData.role === 'admin') {
        adminCount++;
        if (userId === currentUser.uid) {
          isUserAdmin = true;
        }
      }
    });
    
    // If user is the only admin, they can't leave
    if (isUserAdmin && adminCount === 1) {
      throw new Error("You are the only admin. Please promote another member to admin before leaving.");
    }
    
    // Remove user from group
    const updates = {
      [`groups/${groupId}/members/${currentUser.uid}`]: null,
      [`userGroups/${currentUser.uid}/${groupId}`]: null,
      [`chats/${groupId}/participants/${currentUser.uid}`]: null
    };
    
    await update(ref(db), updates);
    
    // Add system message about user leaving
    const messagesRef = ref(db, `messages/${groupId}`);
    const newMessageRef = push(messagesRef);
    
    await set(newMessageRef, {
      type: 'system',
      content: `${currentUser.displayName} left the group`,
      timestamp: Date.now()
    });
  };
  
  // Update group settings
  const updateGroup = async (groupId, updates) => {
    if (!currentUser) throw new Error("You must be signed in");
    
    // Ensure user is an admin
    const groupRef = ref(db, `groups/${groupId}`);
    const groupSnapshot = await get(groupRef);
    
    if (!groupSnapshot.exists()) {
      throw new Error("Group not found");
    }
    
    const groupData = groupSnapshot.val();
    
    if (!groupData.members[currentUser.uid] || 
        groupData.members[currentUser.uid].role !== 'admin') {
      throw new Error("Only admins can update group settings");
    }
    
    // Don't allow updating members through this function
    const sanitizedUpdates = { ...updates };
    delete sanitizedUpdates.members;
    
    await update(groupRef, sanitizedUpdates);
    
    // If name was updated, also update chat name
    if (updates.name) {
      await update(ref(db, `chats/${groupId}`), {
        name: updates.name
      });
    }
  };
  
  return (
    <GroupsContext.Provider value={{
      groups,
      userGroups,
      loading,
      createGroup,
      joinGroup,
      leaveGroup,
      updateGroup,
      getGroupById: (groupId) => groups[groupId] || null,
    }}>
      {children}
    </GroupsContext.Provider>
  );
}

export const useGroups = () => useContext(GroupsContext);
```

## Member Management

I implemented comprehensive controls for adding, removing, and managing group members:

```jsx
// src/components/groups/GroupMembersTab.jsx
function GroupMembersTab({ group }) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { updateMemberRole, removeMember } = useGroups();
  const { currentUser } = useAuth();
  
  const isAdmin = useMemo(() => {
    if (!group || !currentUser) return false;
    const currentMember = group.members[currentUser.uid];
    return currentMember && currentMember.role === 'admin';
  }, [group, currentUser]);
  
  const members = useMemo(() => {
    if (!group?.members) return [];
    
    return Object.entries(group.members)
      .map(([userId, data]) => ({
        userId,
        ...data
      }))
      .sort((a, b) => {
        // Admins first, then sort by join date
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.joinedAt - b.joinedAt;
      });
  }, [group?.members]);
  
  const handleRoleChange = async (userId, newRole) => {
    if (!isAdmin) return;
    
    try {
      await updateMemberRole(group.id, userId, newRole);
    } catch (err) {
      console.error("Error updating member role:", err);
      // Show error notification
    }
  };
  
  const handleRemoveMember = async (userId) => {
    if (!isAdmin) return;
    
    // Confirm before removing
    if (!window.confirm("Are you sure you want to remove this member?")) {
      return;
    }
    
    try {
      await removeMember(group.id, userId);
    } catch (err) {
      console.error("Error removing member:", err);
      // Show error notification
    }
  };
  
  return (
    <div className={styles.membersTab}>
      <div className={styles.tabHeader}>
        <h3>Members ({members.length})</h3>
        
        {isAdmin && (
          <button 
            className={styles.inviteButton}
            onClick={() => setInviteModalOpen(true)}
          >
            Invite Members
          </button>
        )}
      </div>
      
      <div className={styles.membersList}>
        {members.map((member) => (
          <div key={member.userId} className={styles.memberItem}>
            <div className={styles.memberInfo}>
              <UserAvatar userId={member.userId} size="small" />
              
              <div className={styles.memberDetails}>
                <div className={styles.memberName}>
                  <UserName userId={member.userId} />
                  
                  {member.role === 'admin' && (
                    <span className={styles.adminBadge}>Admin</span>
                  )}
                </div>
                
                <div className={styles.memberSince}>
                  Member since {formatDate(member.joinedAt)}
                </div>
              </div>
            </div>
            
            {isAdmin && member.userId !== currentUser.uid && (
              <div className={styles.memberActions}>
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                  className={styles.roleSelect}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                
                <button
                  onClick={() => handleRemoveMember(member.userId)}
                  className={styles.removeButton}
                  aria-label="Remove member"
                  title="Remove member"
                >
                  <RemoveIcon />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {inviteModalOpen && (
        <InviteMembersModal 
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          groupId={group.id}
          existingMembers={Object.keys(group.members)}
        />
      )}
    </div>
  );
}

// src/components/groups/InviteMembersModal.jsx
function InviteMembersModal({ isOpen, onClose, groupId, existingMembers }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { inviteToGroup } = useGroups();
  const { users } = useUsers();
  
  // Filter available users (not already in the group)
  const availableUsers = useMemo(() => {
    return Object.values(users)
      .filter(user => !existingMembers.includes(user.uid))
      .filter(user => {
        if (!searchQuery.trim()) return true;
        return user.displayName.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [users, existingMembers, searchQuery]);
  
  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };
  
  const handleInviteUsers = async () => {
    if (selectedUsers.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await inviteToGroup(groupId, selectedUsers);
      onClose();
    } catch (err) {
      console.error("Error inviting members:", err);
      setError("Failed to invite members. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={styles.modalContent}>
        <h2>Invite Members</h2>
        
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.userList}>
          {availableUsers.length === 0 ? (
            <div className={styles.emptyState}>No users found</div>
          ) : (
            availableUsers.map(user => (
              <div 
                key={user.uid}
                className={`
                  ${styles.userItem} 
                  ${selectedUsers.includes(user.uid) ? styles.selected : ''}
                `}
                onClick={() => handleUserSelect(user.uid)}
              >
                <UserAvatar userId={user.uid} size="small" />
                <span>{user.displayName}</span>
                
                {selectedUsers.includes(user.uid) && (
                  <CheckIcon className={styles.checkIcon} />
                )}
              </div>
            ))
          )}
        </div>
        
        <div className={styles.modalActions}>
          <button 
            onClick={onClose} 
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancel
          </button>
          
          <button 
            onClick={handleInviteUsers} 
            className={styles.inviteButton}
            disabled={isLoading || selectedUsers.length === 0}
          >
            {isLoading ? 'Inviting...' : `Invite (${selectedUsers.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

## Group Settings Management

I built a comprehensive interface for managing group settings:

```jsx
// src/components/groups/GroupSettingsTab.jsx
function GroupSettingsTab({ group }) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [isPublic, setIsPublic] = useState(group?.isPublic || false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const { updateGroup, leaveGroup, deleteGroup } = useGroups();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const isAdmin = useMemo(() => {
    if (!group || !currentUser) return false;
    const currentMember = group.members[currentUser.uid];
    return currentMember && currentMember.role === 'admin';
  }, [group, currentUser]);
  
  // Update form when group changes
  useEffect(() => {
    if (group) {
      setName(group.name || "");
      setDescription(group.description || "");
      setIsPublic(group.isPublic || false);
    }
  }, [group]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) return;
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      await updateGroup(group.id, {
        name: name.trim(),
        description: description.trim(),
        isPublic
      });
      
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating group:", err);
      setError("Failed to update group settings");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) {
      return;
    }
    
    try {
      await leaveGroup(group.id);
      navigate('/'); // Redirect to home
    } catch (err) {
      console.error("Error leaving group:", err);
      setError(err.message);
    }
  };
  
  const handleDeleteGroup = async () => {
    if (!isAdmin) return;
    
    if (!window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      return;
    }
    
    try {
      await deleteGroup(group.id);
      navigate('/'); // Redirect to home
    } catch (err) {
      console.error("Error deleting group:", err);
      setError("Failed to delete group");
    }
  };
  
  if (!group) return null;
  
  return (
    <div className={styles.settingsTab}>
      {isAdmin ? (
        <form onSubmit={handleSubmit} className={styles.settingsForm}>
          <h3>Group Settings</h3>
          
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>Settings updated successfully</div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="groupName">Group Name</label>
            <input
              id="groupName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              className={styles.input}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="groupDescription">Description</label>
            <textarea
              id="groupDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter group description"
              className={styles.textarea}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={() => setIsPublic(!isPublic)}
                className={styles.checkbox}
              />
              Public group (anyone can join)
            </label>
          </div>
          
          <div className={styles.formActions}>
            <button 
              type="submit"
              className={styles.saveButton}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.viewOnlySettings}>
          <h3>Group Info</h3>
          
          <div className={styles.infoItem}>
            <strong>Name:</strong> {group.name}
          </div>
          
          {group.description && (
            <div className={styles.infoItem}>
              <strong>Description:</strong> {group.description}
            </div>
          )}
          
          <div className={styles.infoItem}>
            <strong>Type:</strong> {group.isPublic ? 'Public' : 'Private'} Group
          </div>
          
          <div className={styles.infoItem}>
            <strong>Created:</strong> {formatDate(group.createdAt)}
          </div>
        </div>
      )}
      
      <div className={styles.dangerZone}>
        <h3>Danger Zone</h3>
        
        <button
          onClick={handleLeaveGroup}
          className={styles.leaveButton}
        >
          Leave Group
        </button>
        
        {isAdmin && (
          <button
            onClick={handleDeleteGroup}
            className={styles.deleteButton}
          >
            Delete Group
          </button>
        )}
      </div>
    </div>
  );
}
```

## Technical Challenges

### Permission System

Implementing a robust permission system for group management was challenging:

```jsx
// src/utils/permissions.js
export const GroupPermissions = {
  VIEW: 'view',
  SEND_MESSAGES: 'send_messages',
  INVITE_MEMBERS: 'invite_members',
  REMOVE_MEMBERS: 'remove_members',
  EDIT_SETTINGS: 'edit_settings',
  MANAGE_ROLES: 'manage_roles',
  DELETE_GROUP: 'delete_group'
};

export const RolePermissions = {
  admin: [
    GroupPermissions.VIEW,
    GroupPermissions.SEND_MESSAGES,
    GroupPermissions.INVITE_MEMBERS,
    GroupPermissions.REMOVE_MEMBERS,
    GroupPermissions.EDIT_SETTINGS,
    GroupPermissions.MANAGE_ROLES,
    GroupPermissions.DELETE_GROUP
  ],
  moderator: [
    GroupPermissions.VIEW,
    GroupPermissions.SEND_MESSAGES,
    GroupPermissions.INVITE_MEMBERS,
    GroupPermissions.REMOVE_MEMBERS
  ],
  member: [
    GroupPermissions.VIEW,
    GroupPermissions.SEND_MESSAGES
  ]
};

// Helper to check permissions
export const hasPermission = (user, group, permission) => {
  // Not a member of the group
  if (!user || !group || !group.members || !group.members[user.uid]) {
    // Special case: public groups are viewable by anyone
    if (permission === GroupPermissions.VIEW && group.isPublic) {
      return true;
    }
    return false;
  }
  
  const userRole = group.members[user.uid].role || 'member';
  return RolePermissions[userRole].includes(permission);
};
```

### Managing Group Data Consistency

Ensuring data consistency across chats and groups was complex:

```jsx
// Adding security rules to enforce consistency
// firebase-database-rules.json
{
  "rules": {
    "groups": {
      "$groupId": {
        // Only admins can update group settings
        ".write": "auth !== null && 
                  data.child('members').child(auth.uid).child('role').val() === 'admin'",
        
        // Group members can update specific paths like messages
        "members": {
          ".write": "auth !== null && 
                    (data.child(auth.uid).exists() || 
                     newData.child(auth.uid).exists())"
        }
      }
    },
    "chats": {
      "$chatId": {
        // Enforce consistent participants between chats and groups
        ".validate": "!data.child('isGroup').exists() || 
                      !data.child('isGroup').val() || 
                      root.child('groups').child($chatId).exists()",
        
        "participants": {
          // For group chats, participant list must match group members
          ".validate": "!root.child('groups').child($chatId).exists() || 
                        root.child('groups').child($chatId).child('members').child(auth.uid).exists()"
        }
      }
    }
  }
}
```

### Database Transactions

For critical operations like role changes, I needed to ensure atomicity:

```jsx
// In GroupsContext.jsx
const updateMemberRole = async (groupId, userId, newRole) => {
  if (!currentUser) throw new Error("You must be signed in");
  
  // Get reference to member's role
  const memberRoleRef = ref(db, `groups/${groupId}/members/${userId}/role`);
  
  // Run this as a transaction to prevent race conditions
  return runTransaction(memberRoleRef, (currentRole) => {
    // Validate current user is admin and target role is valid
    if (!isUserGroupAdmin(groupId) || !['admin', 'moderator', 'member'].includes(newRole)) {
      return; // Abort transaction
    }
    
    // If making someone admin, ensure another admin exists if currentUser is demoting themselves
    if (userId === currentUser.uid && currentRole === 'admin' && newRole !== 'admin') {
      // Count other admins to ensure we're not removing the last admin
      let otherAdmins = 0;
      const groupMembers = groups[groupId]?.members || {};
      
      Object.entries(groupMembers).forEach(([memberId, memberData]) => {
        if (memberId !== currentUser.uid && memberData.role === 'admin') {
          otherAdmins++;
        }
      });
      
      if (otherAdmins === 0) {
        throw new Error("Cannot demote yourself as you are the only admin");
      }
    }
    
    return newRole;
  });
};
```

## Future Improvements

I have several ideas to enhance group management:

1. **Role Customization** - Allow group creators to define custom roles with granular permissions.

2. **Subgroups** - Add support for creating subgroups within a main group to organize different topics.

3. **Group Templates** - Presets for creating common group types (team, class, community, etc.).

4. **Group Activity Reports** - Provide admins with insights about member engagement.

5. **Role Assignment Rules** - Automatic role assignment based on user activity or criteria.

The group management system has become one of the most used features in the application, especially for team and community use cases. The robust permission system ensures that everyone gets the right level of access, while the admin tools provide full control over group dynamics. 