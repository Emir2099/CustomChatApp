import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Signup from './pages/Register';
import PrivateRoute from './components/PrivateRoute';
import InvitePage from './pages/InvitePage';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route 
              path="/invite/:chatId/:linkId" 
              element={
                <PrivateRoute>
                  <InvitePage />
                </PrivateRoute>
              } 
            />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Chat />
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;