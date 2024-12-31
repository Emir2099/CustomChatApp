export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [inviteLink, setInviteLink] = useState('');
  
  const clearInviteLink = () => {
    setInviteLink('');
  };

  return (
    <ChatContext.Provider value={{ 
      inviteLink, 
      setInviteLink, 
      clearInviteLink 
    }}>
      {children}
    </ChatContext.Provider>
  );
}; 