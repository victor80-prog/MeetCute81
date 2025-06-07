-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS message_limit_check ON public.messages;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.check_message_limits();
