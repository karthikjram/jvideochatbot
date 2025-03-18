import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import DailyIframe from '@daily-co/daily-js';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  height: 100vh;
  background-color: #f5f5f5;
`;

const VideoContainer = styled.div`
  width: 80%;
  height: 70vh;
  background-color: #000;
  border-radius: 10px;
  overflow: hidden;
  margin: 20px 0;
  position: relative;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 20px;
`;

const Button = styled.button`
  padding: 12px 24px;
  background-color: ${props => props.endCall ? '#dc3545' : '#4CAF50'};
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: ${props => props.endCall ? '#c82333' : '#45a049'};
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const StatusMessage = styled.div`
  margin-top: 10px;
  color: ${props => props.error ? '#ff0000' : '#666'};
`;

function App() {
  const [isJoined, setIsJoined] = useState(false);
  const [conversationUrl, setConversationUrl] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [videoCall, setVideoCall] = useState(null);
  const conversationCreated = useRef(false);

  const endAllExistingConversations = async () => {
    try {
      setStatus('Cleaning up existing conversations...');
      const listResponse = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_TAVUS_API_KEY
        }
      });

      if (!listResponse.ok) {
        console.warn('Could not list conversations:', listResponse.status);
        return;
      }

      const conversations = await listResponse.json();
      
      for (const conversation of conversations) {
        try {
          await fetch(`https://tavusapi.com/v2/conversations/${conversation.id}/end`, {
            method: 'POST',
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.REACT_APP_TAVUS_API_KEY
            }
          });
        } catch (endError) {
          console.warn('Could not end conversation:', conversation.id, endError);
        }
      }
    } catch (error) {
      console.warn('Error in cleanup:', error);
    }
  };

  const createConversation = async () => {
    if (conversationCreated.current || conversationUrl) {
      return null;
    }

    setStatus('Creating conversation...');
    setError('');
    
    try {
      // Try to clean up but don't wait for it
      endAllExistingConversations().catch(console.warn);
      
      const response = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_TAVUS_API_KEY
        },
        body: JSON.stringify({
          "replica_id": "r1fbfc941b",
          "conversational_context": "Your name is Mark. You are an employee of Jio in India. You join a video conversation with a Jio customer. Ask them their name and see how they are doing. You have to answer all the questions they ask you in a patient and friendly manner. Keep your answers and conversations crisp, concise and to the point."
        }),
      });
      
      const data = await response.json();
      
      // If we got a conversation URL, consider it successful regardless of status
      if (data && data.conversation_url) {
        conversationCreated.current = true;
        setConversationUrl(data.conversation_url);
        setStatus('Conversation created successfully');
        setError(''); // Clear any error if we got a valid URL
        return data.conversation_url;
      }
      
      // Only throw error if we didn't get a valid URL
      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.status} - ${JSON.stringify(data)}`);
      }

    } catch (error) {
      // Only set error if we don't have a valid conversation URL
      if (!conversationUrl) {
        setError('Error creating conversation: ' + error.message);
      }
      return null;
    }
  };

  const resetConversation = () => {
    conversationCreated.current = false;
    setConversationUrl('');
    setIsJoined(false);
    setError('');
    setStatus('');
  };

  const joinMeeting = async () => {
    try {
      if (!conversationUrl) {
        setError('No conversation URL available');
        return;
      }

      setStatus('Initializing video chat...');

      if (videoCall) {
        videoCall.destroy();
      }

      const existingFrames = document.querySelectorAll('iframe[title="video call"]');
      existingFrames.forEach(frame => frame.remove());

      const container = document.getElementById('video-container');
      if (!container) {
        throw new Error('Video container not found');
      }

      const callFrame = DailyIframe.createFrame(container, {
        showLeaveButton: false,
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '10px',
        }
      });

      callFrame.on('joined-meeting', () => {
        setIsJoined(true);
        setStatus('Connected to video chat');
      });

      callFrame.on('left-meeting', () => {
        setIsJoined(false);
        setStatus('Left video chat');
      });

      setVideoCall(callFrame);
      setStatus('Joining video chat...');
      await callFrame.join({ url: conversationUrl });
    } catch (error) {
      setError('Error joining meeting: ' + error.message);
    }
  };

  const endConversation = async () => {
    try {
      setStatus('Ending conversation...');
      
      if (videoCall) {
        await videoCall.leave();
        videoCall.destroy();
        setVideoCall(null);
        resetConversation();
        setStatus('Conversation ended');
      }
    } catch (error) {
      setError('Error ending conversation: ' + error.message);
    }
  };

  useEffect(() => {
    createConversation();

    return () => {
      if (videoCall) {
        videoCall.destroy();
      }
    };
  }, []);

  return (
    <Container>
      <h1>Jio Video Bot 2.0</h1>
      <VideoContainer id="video-container" />
      <ButtonContainer>
        <Button 
          onClick={joinMeeting} 
          disabled={isJoined || !conversationUrl}
        >
          {isJoined ? 'Connected' : 'Join Video Chat'}
        </Button>
        {isJoined && (
          <Button 
            onClick={endConversation}
            endCall
          >
            End Conversation
          </Button>
        )}
      </ButtonContainer>
      {status && <StatusMessage>{status}</StatusMessage>}
      {error && <StatusMessage error>{error}</StatusMessage>}
    </Container>
  );
}

export default App;
