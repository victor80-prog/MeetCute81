-- Drop existing message table if it exists
DROP TABLE IF EXISTS messages CASCADE;

-- Create new message table with enhanced features
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    parent_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Create message status table for read receipts
CREATE TABLE message_status (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (message_id, user_id)
);

-- Create message reactions table
CREATE TABLE message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- Create conversations table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create conversation participants table
CREATE TABLE conversation_participants (
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

-- Add conversation_id column to messages table
ALTER TABLE messages ADD CONSTRAINT fk_conversation 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;   
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_participants_updated_at
BEFORE UPDATE ON conversation_participants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id INTEGER, user2_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    conversation_id INTEGER;
    participant_count INTEGER;
BEGIN
    -- Try to find existing conversation
    SELECT cp1.conversation_id INTO conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = user1_id AND cp2.user_id = user2_id
    GROUP BY cp1.conversation_id
    HAVING COUNT(DISTINCT cp1.user_id) = 2
    LIMIT 1;
    
    -- If no conversation exists, create one
    IF conversation_id IS NULL THEN
        INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conversation_id;
        
        -- Add both users to the conversation
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (conversation_id, user1_id), (conversation_id, user2_id);
    END IF;
    
    RETURN conversation_id;
END;
$$ language 'plpgsql';
