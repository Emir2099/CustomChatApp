import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext';  // Adjust import path as needed
import ChatLayout from '../components/chat/ChatLayout';

export default function Chat() {
  const { chatId } = useParams();
  const { clearInviteLink } = useChat();

  useEffect(() => {
    // Clear invite link whenever the chat ID changes
    clearInviteLink();
  }, [chatId, clearInviteLink]);

  return <ChatLayout />;
} 