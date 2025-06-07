--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Ubuntu 17.5-1.pgdg24.04+1)
-- Dumped by pg_dump version 17.5 (Ubuntu 17.5-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscription_tier AS ENUM (
    'Basic',
    'Premium',
    'Elite'
);


ALTER TYPE public.subscription_tier OWNER TO postgres;

--
-- Name: check_max_photos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_max_photos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (
    SELECT COUNT(*) 
    FROM public.user_photos 
    WHERE user_id = NEW.user_id
  ) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 photos allowed per user';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_max_photos() OWNER TO postgres;

--
-- Name: get_or_create_conversation(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_or_create_conversation(user1_id integer, user2_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.get_or_create_conversation(user1_id integer, user2_id integer) OWNER TO postgres;

--
-- Name: get_user_active_features(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_active_features(user_id_param integer) RETURNS TABLE(feature_name character varying)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT sf.feature_name
    FROM user_subscriptions us
    JOIN subscription_packages sp ON us.package_id = sp.id OR us.tier_level = sp.tier_level
    JOIN subscription_features sf ON sp.id = sf.package_id
    WHERE us.user_id = user_id_param
      AND us.status = 'active'
      AND (us.end_date IS NULL OR us.end_date > CURRENT_TIMESTAMP)
      AND sp.is_active = true;
END;
$$;


ALTER FUNCTION public.get_user_active_features(user_id_param integer) OWNER TO postgres;

--
-- Name: has_feature_access(integer, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_feature_access(user_id integer, feature_key character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
DECLARE
    user_tier VARCHAR;
    has_access BOOLEAN;
BEGIN
    -- Get the user's subscription tier
    SELECT sp.tier_level INTO user_tier
    FROM user_subscriptions us
    JOIN subscription_packages sp ON us.package_id = sp.id
    WHERE us.user_id = $1 AND us.status = 'active'
    ORDER BY sp.price DESC
    LIMIT 1;
    
    -- If no subscription found, assume 'Basic'
    IF user_tier IS NULL THEN
        user_tier := 'Basic';
    END IF;
    
    -- Check if the user has access to this feature
    SELECT
        CASE
            WHEN user_tier = 'Elite' THEN fp.elite_access
            WHEN user_tier = 'Premium' THEN fp.premium_access
            ELSE fp.basic_access
        END INTO has_access
    FROM feature_permissions fp
    WHERE fp.feature_key = $2;
    
    RETURN COALESCE(has_access, FALSE);
END;
$_$;


ALTER FUNCTION public.has_feature_access(user_id integer, feature_key character varying) OWNER TO postgres;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_modified_column() OWNER TO postgres;

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_timestamp() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;   
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_actions (
    id integer NOT NULL,
    admin_id integer,
    user_id integer,
    action_type character varying(50) NOT NULL,
    action_details text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin_actions OWNER TO postgres;

--
-- Name: admin_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_actions_id_seq OWNER TO postgres;

--
-- Name: admin_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_actions_id_seq OWNED BY public.admin_actions.id;


--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_logs (
    id integer NOT NULL,
    admin_id integer,
    action character varying(100) NOT NULL,
    target_user_id integer,
    details text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin_logs OWNER TO postgres;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_logs_id_seq OWNER TO postgres;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_logs_id_seq OWNED BY public.admin_logs.id;


--
-- Name: anonymous_browsing_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anonymous_browsing_sessions (
    id integer NOT NULL,
    user_id integer,
    start_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.anonymous_browsing_sessions OWNER TO postgres;

--
-- Name: anonymous_browsing_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anonymous_browsing_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.anonymous_browsing_sessions_id_seq OWNER TO postgres;

--
-- Name: anonymous_browsing_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anonymous_browsing_sessions_id_seq OWNED BY public.anonymous_browsing_sessions.id;


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    conversation_id integer NOT NULL,
    user_id integer NOT NULL,
    last_read_message_id integer,
    is_muted boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: countries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.countries (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(2) NOT NULL,
    phone_code character varying(5) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.countries OWNER TO postgres;

--
-- Name: countries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.countries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.countries_id_seq OWNER TO postgres;

--
-- Name: countries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.countries_id_seq OWNED BY public.countries.id;


--
-- Name: country_payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.country_payment_methods (
    country_id integer NOT NULL,
    payment_method_id integer NOT NULL,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_instructions text,
    configuration_details jsonb,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.country_payment_methods OWNER TO postgres;

--
-- Name: COLUMN country_payment_methods.user_instructions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.country_payment_methods.user_instructions IS 'Instructions for the user on how to complete the payment using this method, if manual steps are required.';


--
-- Name: COLUMN country_payment_methods.configuration_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.country_payment_methods.configuration_details IS 'JSONB blob to store specific configuration for this payment method, like API keys or specific URLs for internal processing.';


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.error_logs (
    id integer NOT NULL,
    user_id uuid,
    endpoint character varying(255),
    error_message text,
    stack_trace text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.error_logs OWNER TO postgres;

--
-- Name: error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.error_logs_id_seq OWNER TO postgres;

--
-- Name: error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;


--
-- Name: feature_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feature_permissions (
    id integer NOT NULL,
    feature_name character varying(100) NOT NULL,
    feature_key character varying(50) NOT NULL,
    basic_access boolean DEFAULT false,
    premium_access boolean DEFAULT false,
    elite_access boolean DEFAULT true,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.feature_permissions OWNER TO postgres;

--
-- Name: feature_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feature_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feature_permissions_id_seq OWNER TO postgres;

--
-- Name: feature_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feature_permissions_id_seq OWNED BY public.feature_permissions.id;


--
-- Name: gift_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_items (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    category character varying(50),
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tier_id integer
);


ALTER TABLE public.gift_items OWNER TO postgres;

--
-- Name: gift_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gift_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gift_items_id_seq OWNER TO postgres;

--
-- Name: gift_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gift_items_id_seq OWNED BY public.gift_items.id;


--
-- Name: gift_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gift_tiers (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    min_subscription_level character varying(20) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT gift_tiers_min_subscription_level_check CHECK (((min_subscription_level)::text = ANY ((ARRAY['Basic'::character varying, 'Premium'::character varying, 'Elite'::character varying])::text[])))
);


ALTER TABLE public.gift_tiers OWNER TO postgres;

--
-- Name: gift_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gift_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gift_tiers_id_seq OWNER TO postgres;

--
-- Name: gift_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gift_tiers_id_seq OWNED BY public.gift_tiers.id;


--
-- Name: likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.likes (
    id integer NOT NULL,
    user_id integer,
    liked_user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.likes OWNER TO postgres;

--
-- Name: likes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.likes_id_seq OWNER TO postgres;

--
-- Name: likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.likes_id_seq OWNED BY public.likes.id;


--
-- Name: likes_visibility; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.likes_visibility (
    user_id integer NOT NULL,
    can_see_likers boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.likes_visibility OWNER TO postgres;

--
-- Name: matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matches (
    id integer NOT NULL,
    user1_id integer,
    user2_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.matches OWNER TO postgres;

--
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.matches_id_seq OWNER TO postgres;

--
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- Name: message_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_limits (
    id integer NOT NULL,
    subscription_level character varying(20) NOT NULL,
    daily_limit integer NOT NULL,
    monthly_limit integer,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_limits_subscription_level_check CHECK (((subscription_level)::text = ANY ((ARRAY['Basic'::character varying, 'Premium'::character varying, 'Elite'::character varying])::text[])))
);


ALTER TABLE public.message_limits OWNER TO postgres;

--
-- Name: message_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.message_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_limits_id_seq OWNER TO postgres;

--
-- Name: message_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_limits_id_seq OWNED BY public.message_limits.id;


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_reactions (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.message_reactions OWNER TO postgres;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.message_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_reactions_id_seq OWNER TO postgres;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_reactions_id_seq OWNED BY public.message_reactions.id;


--
-- Name: message_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_status (
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone
);


ALTER TABLE public.message_status OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text,
    message_type character varying(20) DEFAULT 'text'::character varying NOT NULL,
    parent_message_id integer,
    is_edited boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_methods_id_seq OWNER TO postgres;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: profile_boosts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_boosts (
    id integer NOT NULL,
    user_id integer,
    boost_type character varying(50) NOT NULL,
    start_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp with time zone,
    multiplier numeric(3,1) DEFAULT 1.5,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.profile_boosts OWNER TO postgres;

--
-- Name: profile_boosts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profile_boosts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profile_boosts_id_seq OWNER TO postgres;

--
-- Name: profile_boosts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profile_boosts_id_seq OWNED BY public.profile_boosts.id;


--
-- Name: profile_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_views (
    id integer NOT NULL,
    viewer_id integer NOT NULL,
    viewed_user_id integer NOT NULL,
    viewed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    viewed_date date DEFAULT CURRENT_DATE
);


ALTER TABLE public.profile_views OWNER TO postgres;

--
-- Name: profile_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profile_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profile_views_id_seq OWNER TO postgres;

--
-- Name: profile_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profile_views_id_seq OWNED BY public.profile_views.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    user_id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    dob date NOT NULL,
    gender character varying(20) NOT NULL,
    bio text,
    profile_pic character varying(255),
    profile_picture character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: reported_content; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reported_content (
    id integer NOT NULL,
    reporter_id integer,
    reported_user_id integer,
    type character varying(50) NOT NULL,
    content_id integer,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    CONSTRAINT reported_content_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'reviewed'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[]))),
    CONSTRAINT reported_content_type_check CHECK (((type)::text = ANY ((ARRAY['profile'::character varying, 'photo'::character varying, 'message'::character varying, 'activity'::character varying])::text[])))
);


ALTER TABLE public.reported_content OWNER TO postgres;

--
-- Name: reported_content_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reported_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reported_content_id_seq OWNER TO postgres;

--
-- Name: reported_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reported_content_id_seq OWNED BY public.reported_content.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    version bigint NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.schema_migrations OWNER TO postgres;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schema_migrations_id_seq OWNER TO postgres;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: subscription_features; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_features (
    id integer NOT NULL,
    package_id integer,
    feature_name character varying(200) NOT NULL,
    feature_description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    premium_only boolean DEFAULT false,
    elite_only boolean DEFAULT false
);


ALTER TABLE public.subscription_features OWNER TO postgres;

--
-- Name: subscription_features_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_features_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_features_id_seq OWNER TO postgres;

--
-- Name: subscription_features_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_features_id_seq OWNED BY public.subscription_features.id;


--
-- Name: subscription_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_packages (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    price numeric(10,2) NOT NULL,
    billing_interval character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    duration_months integer DEFAULT 1,
    tier_level character varying(20),
    CONSTRAINT subscription_packages_tier_level_check CHECK (((tier_level)::text = ANY ((ARRAY['Basic'::character varying, 'Premium'::character varying, 'Elite'::character varying])::text[])))
);


ALTER TABLE public.subscription_packages OWNER TO postgres;

--
-- Name: subscription_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_packages_id_seq OWNER TO postgres;

--
-- Name: subscription_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_packages_id_seq OWNED BY public.subscription_packages.id;


--
-- Name: subscription_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_transactions (
    id integer NOT NULL,
    subscription_id integer,
    amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'completed'::character varying NOT NULL,
    payment_method character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subscription_transactions OWNER TO postgres;

--
-- Name: subscription_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_transactions_id_seq OWNER TO postgres;

--
-- Name: subscription_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_transactions_id_seq OWNED BY public.subscription_transactions.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    assigned_to integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer,
    item_category character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending_payment'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_provided_reference text,
    admin_notes text,
    payable_item_id integer,
    currency character varying(10),
    payment_country_id integer,
    payment_method_type_id integer,
    payment_method_id integer,
    payment_reference character varying(255),
    description text,
    payment_details jsonb,
    type character varying(50) DEFAULT 'debit'::character varying NOT NULL,
    CONSTRAINT transactions_item_category_check CHECK (((item_category)::text = ANY ((ARRAY['subscription'::character varying, 'gift'::character varying, 'deposit'::character varying])::text[]))),
    CONSTRAINT transactions_status_new_check CHECK (((status)::text = ANY ((ARRAY['pending_payment'::character varying, 'pending_verification'::character varying, 'completed'::character varying, 'declined'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying, 'gift_sent'::character varying, 'gift_received'::character varying])::text[])))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: COLUMN transactions.item_category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.item_category IS 'Category of the item being purchased (e.g., subscription, gift, deposit).';


--
-- Name: COLUMN transactions.user_provided_reference; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.user_provided_reference IS 'User-provided reference for the payment (e.g., M-Pesa transaction ID).';


--
-- Name: COLUMN transactions.admin_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.admin_notes IS 'Notes added by an admin regarding this transaction.';


--
-- Name: COLUMN transactions.payable_item_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.payable_item_id IS 'ID of the item being paid for (e.g., subscription_id, gift_id if specific tracking needed beyond item_category).';


--
-- Name: COLUMN transactions.currency; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.currency IS 'Currency code for the transaction amount (e.g., USD, KES).';


--
-- Name: COLUMN transactions.payment_country_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.payment_country_id IS 'Country where the payment is being made/processed.';


--
-- Name: COLUMN transactions.payment_method_type_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.payment_method_type_id IS 'The global type of payment method used (e.g., MPESA, PAYPAL).';


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_activities (
    id integer NOT NULL,
    user_id integer NOT NULL,
    swipe_count integer DEFAULT 0 NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    activity_date date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_activities OWNER TO postgres;

--
-- Name: user_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_activities_id_seq OWNER TO postgres;

--
-- Name: user_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_activities_id_seq OWNED BY public.user_activities.id;


--
-- Name: user_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_balances (
    id integer NOT NULL,
    user_id integer NOT NULL,
    balance numeric(10,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_balances OWNER TO postgres;

--
-- Name: user_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_balances_id_seq OWNER TO postgres;

--
-- Name: user_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_balances_id_seq OWNED BY public.user_balances.id;


--
-- Name: user_gifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_gifts (
    id integer NOT NULL,
    sender_id integer,
    recipient_id integer,
    gift_item_id integer,
    message text,
    is_anonymous boolean DEFAULT false,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    original_purchase_price numeric(10,2) DEFAULT 0.00 NOT NULL,
    is_redeemed boolean DEFAULT false NOT NULL,
    redeemed_at timestamp without time zone,
    redeemed_value numeric(10,2),
    CONSTRAINT user_gifts_original_purchase_price_check CHECK ((original_purchase_price >= (0)::numeric))
);


ALTER TABLE public.user_gifts OWNER TO postgres;

--
-- Name: user_gifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_gifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_gifts_id_seq OWNER TO postgres;

--
-- Name: user_gifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_gifts_id_seq OWNED BY public.user_gifts.id;


--
-- Name: user_photos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_photos (
    id integer NOT NULL,
    user_id integer,
    photo_url text NOT NULL,
    is_profile_picture boolean DEFAULT false,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_photos OWNER TO postgres;

--
-- Name: user_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_photos_id_seq OWNER TO postgres;

--
-- Name: user_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_photos_id_seq OWNED BY public.user_photos.id;


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_subscriptions (
    id integer NOT NULL,
    user_id integer,
    package_id integer,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    start_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_date timestamp with time zone NOT NULL,
    auto_renew boolean DEFAULT true,
    payment_method_id character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tier_level public.subscription_tier NOT NULL,
    CONSTRAINT user_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.user_subscriptions OWNER TO postgres;

--
-- Name: user_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_subscriptions_id_seq OWNER TO postgres;

--
-- Name: user_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_subscriptions_id_seq OWNED BY public.user_subscriptions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    profile_complete boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_suspended boolean DEFAULT false,
    suspension_reason text,
    suspension_end_date timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now(),
    suspended_at timestamp with time zone,
    country_id integer,
    phone character varying(20),
    phone_verified boolean DEFAULT false,
    email_verification_token character varying(255),
    is_email_verified boolean DEFAULT false NOT NULL,
    subscription_tier character varying(20) DEFAULT 'free'::character varying NOT NULL,
    message_count_today integer DEFAULT 0,
    last_message_date date,
    swipe_count_today integer DEFAULT 0,
    last_swipe_date date,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'staff'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.withdrawal_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    payment_details text NOT NULL,
    processed_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    CONSTRAINT withdrawal_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'processed'::character varying])::text[])))
);


ALTER TABLE public.withdrawal_requests OWNER TO postgres;

--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.withdrawal_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.withdrawal_requests_id_seq OWNER TO postgres;

--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.withdrawal_requests_id_seq OWNED BY public.withdrawal_requests.id;


--
-- Name: admin_actions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_actions ALTER COLUMN id SET DEFAULT nextval('public.admin_actions_id_seq'::regclass);


--
-- Name: admin_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_logs_id_seq'::regclass);


--
-- Name: anonymous_browsing_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anonymous_browsing_sessions ALTER COLUMN id SET DEFAULT nextval('public.anonymous_browsing_sessions_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: countries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries ALTER COLUMN id SET DEFAULT nextval('public.countries_id_seq'::regclass);


--
-- Name: error_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);


--
-- Name: feature_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_permissions ALTER COLUMN id SET DEFAULT nextval('public.feature_permissions_id_seq'::regclass);


--
-- Name: gift_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_items ALTER COLUMN id SET DEFAULT nextval('public.gift_items_id_seq'::regclass);


--
-- Name: gift_tiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_tiers ALTER COLUMN id SET DEFAULT nextval('public.gift_tiers_id_seq'::regclass);


--
-- Name: likes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes ALTER COLUMN id SET DEFAULT nextval('public.likes_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- Name: message_limits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_limits ALTER COLUMN id SET DEFAULT nextval('public.message_limits_id_seq'::regclass);


--
-- Name: message_reactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions ALTER COLUMN id SET DEFAULT nextval('public.message_reactions_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: profile_boosts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_boosts ALTER COLUMN id SET DEFAULT nextval('public.profile_boosts_id_seq'::regclass);


--
-- Name: profile_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_views ALTER COLUMN id SET DEFAULT nextval('public.profile_views_id_seq'::regclass);


--
-- Name: reported_content id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reported_content ALTER COLUMN id SET DEFAULT nextval('public.reported_content_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: subscription_features id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_features ALTER COLUMN id SET DEFAULT nextval('public.subscription_features_id_seq'::regclass);


--
-- Name: subscription_packages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_packages ALTER COLUMN id SET DEFAULT nextval('public.subscription_packages_id_seq'::regclass);


--
-- Name: subscription_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_transactions ALTER COLUMN id SET DEFAULT nextval('public.subscription_transactions_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_activities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activities ALTER COLUMN id SET DEFAULT nextval('public.user_activities_id_seq'::regclass);


--
-- Name: user_balances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_balances ALTER COLUMN id SET DEFAULT nextval('public.user_balances_id_seq'::regclass);


--
-- Name: user_gifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gifts ALTER COLUMN id SET DEFAULT nextval('public.user_gifts_id_seq'::regclass);


--
-- Name: user_photos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_photos ALTER COLUMN id SET DEFAULT nextval('public.user_photos_id_seq'::regclass);


--
-- Name: user_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.user_subscriptions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: withdrawal_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests ALTER COLUMN id SET DEFAULT nextval('public.withdrawal_requests_id_seq'::regclass);


--
-- Data for Name: admin_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_actions (id, admin_id, user_id, action_type, action_details, "timestamp") FROM stdin;
\.


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_logs (id, admin_id, action, target_user_id, details, created_at) FROM stdin;
1	\N	UPDATE_USER_STATUS	1	Status changed to suspended	2025-05-31 21:44:40.077399+03
2	\N	UPDATE_USER_STATUS	1	Status changed to active	2025-06-01 08:44:03.676497+03
3	\N	UPDATE_USER_STATUS	1	Status changed to suspended	2025-06-01 09:48:41.696038+03
4	\N	UPDATE_USER_STATUS	8	Status changed to active	2025-06-01 09:59:13.807323+03
5	\N	UPDATE_USER_STATUS	8	Status changed to suspended: Spamming	2025-06-01 09:59:46.499586+03
6	\N	UPDATE_USER_STATUS	1	Status changed to active	2025-06-01 10:03:14.780932+03
7	13	UPDATE_REPORT_STATUS	7	Updated report 21 status to reviewed	2025-06-01 10:51:24.850617+03
8	13	UPDATE_USER_STATUS	8	Status changed to active	2025-06-01 18:30:30.405578+03
9	13	UPDATE_USER_STATUS	20	Status changed to suspended: spamming	2025-06-02 20:18:04.041031+03
10	13	UPDATE_USER_STATUS	19	Status changed to suspended: n	2025-06-03 21:00:45.578594+03
\.


--
-- Data for Name: anonymous_browsing_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.anonymous_browsing_sessions (id, user_id, start_time, end_time, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversation_participants (conversation_id, user_id, last_read_message_id, is_muted, is_archived, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.countries (id, name, code, phone_code, created_at) FROM stdin;
1	United States	US	+1	2025-06-01 11:27:18.396154+03
2	United Kingdom	GB	+44	2025-06-01 11:27:18.396154+03
3	Canada	CA	+1	2025-06-01 11:27:18.396154+03
4	Australia	AU	+61	2025-06-01 11:27:18.396154+03
5	Nigeria	NG	+234	2025-06-01 11:27:18.396154+03
6	South Africa	ZA	+27	2025-06-01 11:27:18.396154+03
7	Kenya	KE	+254	2025-06-01 11:27:18.396154+03
8	Ghana	GH	+233	2025-06-01 11:27:18.396154+03
9	India	IN	+91	2025-06-01 11:27:18.396154+03
10	China	CN	+86	2025-06-01 11:27:18.396154+03
11	Japan	JP	+81	2025-06-01 11:27:18.396154+03
12	Brazil	BR	+55	2025-06-01 11:27:18.396154+03
13	Mexico	MX	+52	2025-06-01 11:27:18.396154+03
14	Germany	DE	+49	2025-06-01 11:27:18.396154+03
15	France	FR	+33	2025-06-01 11:27:18.396154+03
31	Spain	ES	+34	2025-06-01 11:32:57.867649+03
32	Italy	IT	+39	2025-06-01 11:32:57.867649+03
33	Singapore	SG	+65	2025-06-01 11:32:57.867649+03
34	South Korea	KR	+82	2025-06-01 11:32:57.867649+03
35	United Arab Emirates	AE	+971	2025-06-01 11:32:57.867649+03
36	Saudi Arabia	SA	+966	2025-06-01 11:32:57.867649+03
37	Netherlands	NL	+31	2025-06-01 11:32:57.867649+03
38	Belgium	BE	+32	2025-06-01 11:32:57.867649+03
39	Sweden	SE	+46	2025-06-01 11:32:57.867649+03
40	New Zealand	NZ	+64	2025-06-01 11:32:57.867649+03
48	Tanzania	TZ	+255	2025-06-01 11:35:38.333625+03
49	Uganda	UG	+256	2025-06-01 11:35:38.333625+03
50	Zimbabwe	ZW	+263	2025-06-01 11:35:38.333625+03
51	Zambia	ZM	+260	2025-06-01 11:35:38.333625+03
\.


--
-- Data for Name: country_payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.country_payment_methods (country_id, payment_method_id, is_active, priority, created_at, user_instructions, configuration_details, updated_at) FROM stdin;
7	3	t	1	2025-06-01 11:27:18.396154+03	Pay the money to the paybil above and paste the transaction code	{"account": "P", "paybill": "907765"}	2025-06-04 05:12:12.082054+03
7	1	t	1	2025-06-01 11:27:18.396154+03	Sorry we do not currently support card payments.	{}	2025-06-04 05:18:42.781526+03
7	41	t	1	2025-06-04 05:24:52.98662+03	Pay the money to the PayBill number above and paste the transaction code	{"account_number": "", "paybill_number": "123456"}	2025-06-04 05:24:52.98662+03
49	3	t	1	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
50	4	t	2	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
51	4	t	2	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
6	4	t	2	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
10	5	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
10	6	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
9	7	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
14	8	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
14	21	t	4	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
14	19	t	4	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
15	8	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
37	20	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
38	8	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
38	21	t	4	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
33	22	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
35	23	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
36	23	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
13	24	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
1	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
2	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
3	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
4	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
5	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
6	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
8	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
9	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
10	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
11	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
12	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
13	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
14	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
15	1	t	1	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
31	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
32	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
33	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
34	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
35	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
36	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
37	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
38	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
39	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
40	1	t	1	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
49	1	t	1	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
50	1	t	1	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
51	1	t	1	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
1	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
2	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
3	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
4	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
5	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
6	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
8	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
9	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
10	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
11	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
12	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
13	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
14	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
15	2	t	2	2025-06-01 11:27:18.396154+03	\N	\N	2025-06-04 05:11:32.775338+03
31	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
32	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
33	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
34	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
35	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
36	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
37	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
38	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
39	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
40	2	t	2	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
49	2	t	2	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
50	2	t	2	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
51	2	t	2	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
1	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
2	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
3	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
4	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
5	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
6	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
7	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
8	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
9	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
10	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
11	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
12	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
13	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
14	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
15	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
31	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
32	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
33	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
34	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
35	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
36	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
37	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
38	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
39	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
40	17	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
49	17	t	3	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
50	17	t	3	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
51	17	t	3	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
1	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
2	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
3	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
4	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
5	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
6	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
7	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
8	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
9	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
10	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
11	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
12	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
13	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
14	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
15	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
31	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
32	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
33	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
34	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
35	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
36	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
37	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
38	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
39	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
40	18	t	3	2025-06-01 11:32:57.867649+03	\N	\N	2025-06-04 05:11:32.775338+03
49	18	t	3	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
50	18	t	3	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
51	18	t	3	2025-06-01 11:35:38.333625+03	\N	\N	2025-06-04 05:11:32.775338+03
48	4	t	1	2025-06-01 14:56:24.876297+03	\N	\N	2025-06-04 05:11:32.775338+03
7	2	t	2	2025-06-01 11:27:18.396154+03	Send amoount to meetcute@gmail.com	{"paypal": "m"}	2025-06-04 05:13:42.947678+03
\.


--
-- Data for Name: error_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.error_logs (id, user_id, endpoint, error_message, stack_trace, created_at) FROM stdin;
\.


--
-- Data for Name: feature_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feature_permissions (id, feature_name, feature_key, basic_access, premium_access, elite_access, description, created_at) FROM stdin;
1	Basic Matching	basic_matching	t	t	t	Access to basic matching algorithm	2025-06-03 06:25:19.418425+03
2	Profile Creation	profile_creation	t	t	t	Ability to create a dating profile	2025-06-03 06:25:19.418425+03
3	Messaging	messaging	t	t	t	Ability to send messages	2025-06-03 06:25:19.418425+03
4	Basic Search	basic_search	t	t	t	Access to basic search functionality	2025-06-03 06:25:19.418425+03
5	Advanced Matching	advanced_matching	f	t	t	Access to enhanced matching algorithms	2025-06-03 06:25:19.418425+03
6	Enhanced Profile	enhanced_profile	f	t	t	Additional profile customization options	2025-06-03 06:25:19.418425+03
7	Unlimited Messages	unlimited_messages	f	t	t	No limits on messaging	2025-06-03 06:25:19.418425+03
8	Advanced Search	advanced_search	f	t	t	Advanced search filters and options	2025-06-03 06:25:19.418425+03
9	Read Receipts	read_receipts	f	t	t	See when messages are read	2025-06-03 06:25:19.418425+03
10	Profile Boost	profile_boost	f	t	t	Boost visibility in search results	2025-06-03 06:25:19.418425+03
11	See Who Likes You	see_likers	f	t	t	See users who have liked your profile	2025-06-03 06:25:19.418425+03
12	Priority Matching	priority_matching	f	f	t	Get priority in matching queue	2025-06-03 06:25:19.418425+03
13	Premium Profile	premium_profile	f	f	t	Exclusive profile features and badges	2025-06-03 06:25:19.418425+03
14	Elite Search	elite_search	f	f	t	Advanced search with additional criteria	2025-06-03 06:25:19.418425+03
15	Message Priority	message_priority	f	f	t	Messages appear at the top of recipients inboxes	2025-06-03 06:25:19.418425+03
16	Profile Spotlight	profile_spotlight	f	f	t	Featured profile on discover page	2025-06-03 06:25:19.418425+03
17	Anonymous Browsing	anonymous_browsing	f	f	t	Browse profiles without being seen	2025-06-03 06:25:19.418425+03
18	Video Chat	video_chat	f	f	t	Access to video chat functionality	2025-06-03 06:25:19.418425+03
19	Personal Matchmaker	matchmaker	f	f	t	Personalized matchmaking service	2025-06-03 06:25:19.418425+03
20	Exclusive Events	exclusive_events	f	f	t	Access to elite-only virtual and in-person events	2025-06-03 06:25:19.418425+03
\.


--
-- Data for Name: gift_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gift_items (id, name, description, price, image_url, category, is_available, created_at, tier_id) FROM stdin;
1	Virtual Rose	A beautiful virtual rose to show your affection	5.99	https://images.unsplash.com/photo-1559563458-527698bf5295	Flowers	t	2025-05-31 17:27:05.266895	1
2	Digital Chocolate Box	Sweet virtual chocolates for your sweetheart	9.99	https://images.unsplash.com/photo-1549007994-cb92caebd54b	Sweets	t	2025-05-31 17:27:05.266895	1
3	Premium Message	Send a special message with premium formatting and effects	2.99	https://images.unsplash.com/photo-1579208575657-c595a05383b7	Messages	t	2025-05-31 17:27:05.266895	1
4	Golden Rose	\N	19.99	\N	\N	t	2025-06-05 07:58:00.59851	2
5	Diamond Ring	\N	49.99	\N	\N	t	2025-06-05 07:58:00.59851	3
\.


--
-- Data for Name: gift_tiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gift_tiers (id, name, min_subscription_level, description, created_at) FROM stdin;
1	Standard	Basic	Standard gifts available to all subscribers	2025-06-03 06:25:19.423566+03
2	Premium	Premium	Premium gifts available to Premium and Elite subscribers only	2025-06-03 06:25:19.423566+03
3	Elite	Elite	Exclusive gifts available to Elite subscribers only	2025-06-03 06:25:19.423566+03
\.


--
-- Data for Name: likes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.likes (id, user_id, liked_user_id, created_at) FROM stdin;
63	15	44	2025-06-05 11:35:31.796242
64	15	41	2025-06-05 11:35:33.581134
65	41	18	2025-06-05 12:04:22.584909
66	41	44	2025-06-05 12:04:23.26725
67	44	18	2025-06-05 12:04:44.729976
68	40	15	2025-06-05 12:10:03.073593
69	40	44	2025-06-05 12:10:04.466737
70	40	18	2025-06-05 12:10:06.078228
71	42	15	2025-06-05 12:41:27.625603
72	42	44	2025-06-05 12:41:31.19096
73	42	40	2025-06-05 12:41:32.581247
74	42	41	2025-06-05 12:41:33.968607
75	49	42	2025-06-05 19:22:39.671255
17	15	13	2025-06-02 14:57:55.365929
41	18	15	2025-06-02 15:16:32.849332
43	18	13	2025-06-02 15:22:13.28171
\.


--
-- Data for Name: likes_visibility; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.likes_visibility (user_id, can_see_likers, updated_at) FROM stdin;
\.


--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.matches (id, user1_id, user2_id, created_at) FROM stdin;
8	40	41	2025-06-05 07:52:15.653002
9	41	40	2025-06-05 07:52:15.653002
\.


--
-- Data for Name: message_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_limits (id, subscription_level, daily_limit, monthly_limit, description, created_at) FROM stdin;
1	Basic	10	100	Basic tier message limits	2025-06-03 06:27:45.426641+03
2	Premium	1000	10000	Premium tier message limits	2025-06-03 06:27:45.426641+03
3	Elite	9999	99999	Unlimited messaging for Elite tier	2025-06-03 06:27:45.426641+03
\.


--
-- Data for Name: message_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_reactions (id, message_id, user_id, emoji, created_at) FROM stdin;
\.


--
-- Data for Name: message_status; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_status (message_id, user_id, is_read, read_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, sender_id, content, message_type, parent_message_id, is_edited, is_deleted, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (id, name, code, description, is_active, created_at) FROM stdin;
1	Credit Card	card	Pay with credit or debit card	t	2025-06-01 11:27:18.396154+03
2	PayPal	paypal	Pay with PayPal	t	2025-06-01 11:27:18.396154+03
3	M-Pesa	mpesa	Pay with M-Pesa mobile money	t	2025-06-01 11:27:18.396154+03
4	Bank Transfer	bank_transfer	Pay via bank transfer	t	2025-06-01 11:27:18.396154+03
5	Alipay	alipay	Pay with Alipay	t	2025-06-01 11:27:18.396154+03
6	WeChat Pay	wechat	Pay with WeChat Pay	t	2025-06-01 11:27:18.396154+03
7	UPI	upi	Pay with UPI	t	2025-06-01 11:27:18.396154+03
8	SEPA Direct Debit	sepa	Pay via SEPA Direct Debit	t	2025-06-01 11:27:18.396154+03
17	Google Pay	googlepay	Pay with Google Pay	t	2025-06-01 11:32:57.867649+03
18	Apple Pay	applepay	Pay with Apple Pay	t	2025-06-01 11:32:57.867649+03
19	Klarna	klarna	Pay with Klarna	t	2025-06-01 11:32:57.867649+03
20	iDEAL	ideal	Pay with iDEAL	t	2025-06-01 11:32:57.867649+03
21	Sofort	sofort	Pay with Sofort	t	2025-06-01 11:32:57.867649+03
22	GrabPay	grabpay	Pay with GrabPay	t	2025-06-01 11:32:57.867649+03
23	KNET	knet	Pay with KNET	t	2025-06-01 11:32:57.867649+03
24	OXXO	oxxo	Pay with OXXO	t	2025-06-01 11:32:57.867649+03
41	M-Pesa	MPESA	Mobile money payment via M-Pesa	t	2025-06-04 05:23:33.80191+03
\.


--
-- Data for Name: profile_boosts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profile_boosts (id, user_id, boost_type, start_time, end_time, multiplier, created_at) FROM stdin;
\.


--
-- Data for Name: profile_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profile_views (id, viewer_id, viewed_user_id, viewed_at, viewed_date) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (user_id, first_name, last_name, dob, gender, bio, profile_pic, profile_picture, created_at, updated_at) FROM stdin;
13	Admin	User	1990-01-01	other	System Administrator	\N	\N	2025-06-05 10:50:55.307727+03	2025-06-05 10:50:55.307727+03
18	New	User	2000-01-01	Other	No bio yet	\N	\N	2025-06-05 10:50:55.307727+03	2025-06-05 10:50:55.307727+03
7	Test	User	1990-01-01	other	Test user profile	\N	default-profile.jpg	2025-06-05 10:50:55.307727+03	2025-06-05 10:50:55.307727+03
43	Admin	User	1990-01-01	Other	Admin test user	default.jpg	\N	2025-06-05 10:50:55.307727+03	2025-06-05 10:50:55.307727+03
15	Sharon	Cherono	1999-10-10	female	I love skiing	\N	/uploads/profile-pictures/profile-1749114236649-4645719.jpeg	2025-06-05 10:50:55.307727+03	2025-06-05 12:03:56.668289+03
44	Test	Userr	1991-10-10	male	I am a test user	\N	/uploads/profile-pictures/profile-1749114340341-792078991.jpeg	2025-06-05 10:52:08.684507+03	2025-06-05 12:05:40.345282+03
41	Premium	User	1091-12-10	male	Prem	default.jpg	/uploads/profile-pictures/profile-1749114410279-61374160.jpeg	2025-06-05 10:50:55.307727+03	2025-06-05 12:06:50.283901+03
40	Basic	User	1991-10-10	female	Basic user	default.jpg	/uploads/profile-pictures/profile-1749103362522-641765155.jpeg	2025-06-05 10:50:55.307727+03	2025-06-05 12:07:54.474476+03
42	Elite	User	2002-12-10	male	Man	default.jpg	\N	2025-06-05 10:50:55.307727+03	2025-06-05 12:40:20.927606+03
49	Sandra	Manila	1989-02-10	female	I love cooking	\N	\N	2025-06-05 19:22:28.092018+03	2025-06-05 19:22:28.092018+03
\.


--
-- Data for Name: reported_content; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reported_content (id, reporter_id, reported_user_id, type, content_id, reason, status, notes, created_at, updated_at, reviewed_by, reviewed_at) FROM stdin;
1	7	8	photo	\N	Spam	pending	\N	2025-06-01 10:20:31.762155+03	2025-06-01 10:20:31.762155+03	\N	\N
2	7	1	photo	\N	Suspicious behavior	pending	\N	2025-06-01 10:20:31.762155+03	2025-06-01 10:20:31.762155+03	\N	\N
3	8	7	photo	\N	Inappropriate content	pending	\N	2025-06-01 10:20:31.762155+03	2025-06-01 10:20:31.762155+03	\N	\N
4	8	1	photo	\N	Harassment	pending	\N	2025-06-01 10:20:31.762155+03	2025-06-01 10:20:31.762155+03	\N	\N
5	1	7	profile	\N	Inappropriate content	pending	\N	2025-06-01 10:20:31.762155+03	2025-06-01 10:20:31.762155+03	\N	\N
6	1	8	profile	\N	Inappropriate content	pending	\N	2025-06-01 10:20:31.762155+03	2025-06-01 10:20:31.762155+03	\N	\N
7	7	8	activity	\N	Harassment	pending	\N	2025-06-01 10:23:04.632347+03	2025-06-01 10:23:04.632347+03	\N	\N
8	7	1	activity	\N	Spam	pending	\N	2025-06-01 10:23:04.632347+03	2025-06-01 10:23:04.632347+03	\N	\N
9	8	7	message	\N	Harassment	pending	\N	2025-06-01 10:23:04.632347+03	2025-06-01 10:23:04.632347+03	\N	\N
10	8	1	message	\N	Spam	pending	\N	2025-06-01 10:23:04.632347+03	2025-06-01 10:23:04.632347+03	\N	\N
11	1	7	activity	\N	Spam	pending	\N	2025-06-01 10:23:04.632347+03	2025-06-01 10:23:04.632347+03	\N	\N
12	1	8	message	\N	Inappropriate content	pending	\N	2025-06-01 10:23:04.632347+03	2025-06-01 10:23:04.632347+03	\N	\N
13	7	8	photo	\N	Spam	pending	\N	2025-06-01 10:23:41.79678+03	2025-06-01 10:23:41.79678+03	\N	\N
14	7	1	activity	\N	Inappropriate content	pending	\N	2025-06-01 10:23:41.79678+03	2025-06-01 10:23:41.79678+03	\N	\N
15	8	7	activity	\N	Suspicious behavior	pending	\N	2025-06-01 10:23:41.79678+03	2025-06-01 10:23:41.79678+03	\N	\N
16	8	1	photo	\N	Suspicious behavior	pending	\N	2025-06-01 10:23:41.79678+03	2025-06-01 10:23:41.79678+03	\N	\N
17	1	7	message	\N	Spam	pending	\N	2025-06-01 10:23:41.79678+03	2025-06-01 10:23:41.79678+03	\N	\N
18	1	8	photo	\N	Harassment	pending	\N	2025-06-01 10:23:41.79678+03	2025-06-01 10:23:41.79678+03	\N	\N
19	7	8	profile	\N	Inappropriate content	pending	\N	2025-06-01 10:44:34.38797+03	2025-06-01 10:44:34.38797+03	\N	\N
20	7	1	profile	\N	Suspicious behavior	pending	\N	2025-06-01 10:44:34.38797+03	2025-06-01 10:44:34.38797+03	\N	\N
22	8	1	photo	\N	Suspicious behavior	pending	\N	2025-06-01 10:44:34.38797+03	2025-06-01 10:44:34.38797+03	\N	\N
23	1	7	message	\N	Suspicious behavior	pending	\N	2025-06-01 10:44:34.38797+03	2025-06-01 10:44:34.38797+03	\N	\N
24	1	8	message	\N	Spam	pending	\N	2025-06-01 10:44:34.38797+03	2025-06-01 10:44:34.38797+03	\N	\N
21	8	7	message	\N	Spam	reviewed	Status updated to reviewed by admin	2025-06-01 10:44:34.38797+03	2025-06-01 10:51:24.850617+03	13	2025-06-01 10:51:24.850617+03
25	7	8	photo	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
26	7	20	activity	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
27	7	1	activity	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
28	7	19	profile	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
29	7	18	activity	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
30	7	14	profile	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
31	7	15	activity	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
32	7	16	photo	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
33	8	7	photo	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
34	8	20	photo	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
35	8	1	activity	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
36	8	19	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
37	8	18	profile	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
38	8	14	message	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
39	8	15	profile	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
40	8	16	activity	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
41	20	7	message	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
42	20	8	activity	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
43	20	1	photo	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
44	20	19	profile	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
45	20	18	message	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
46	20	14	message	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
47	20	15	profile	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
48	20	16	profile	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
49	1	7	message	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
50	1	8	message	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
51	1	20	activity	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
52	1	19	message	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
53	1	18	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
54	1	14	photo	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
55	1	15	photo	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
56	1	16	profile	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
57	19	7	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
58	19	8	activity	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
59	19	20	message	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
60	19	1	profile	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
61	19	18	photo	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
62	19	14	profile	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
63	19	15	activity	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
64	19	16	message	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
65	18	7	message	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
66	18	8	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
67	18	20	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
68	18	1	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
69	18	19	profile	\N	Harassment	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
70	18	14	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
71	18	15	activity	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
72	18	16	photo	\N	Spam	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
73	14	7	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
74	14	8	message	\N	Inappropriate content	pending	\N	2025-06-04 08:32:19.790608+03	2025-06-04 08:32:19.790608+03	\N	\N
75	7	8	message	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
76	7	20	photo	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
77	7	1	message	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
78	7	19	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
79	7	18	activity	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
80	7	14	activity	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
81	7	15	activity	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
82	7	16	message	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
83	8	7	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
84	8	20	message	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
85	8	1	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
86	8	19	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
87	8	18	message	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
88	8	14	photo	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
89	8	15	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
90	8	16	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
91	20	7	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
92	20	8	activity	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
93	20	1	activity	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
94	20	19	photo	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
95	20	18	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
96	20	14	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
97	20	15	message	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
98	20	16	message	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
99	1	7	photo	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
100	1	8	photo	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
101	1	20	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
102	1	19	profile	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
103	1	18	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
104	1	14	profile	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
105	1	15	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
106	1	16	photo	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
107	19	7	message	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
108	19	8	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
109	19	20	message	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
110	19	1	photo	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
111	19	18	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
112	19	14	message	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
113	19	15	photo	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
114	19	16	photo	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
115	18	7	photo	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
116	18	8	message	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
117	18	20	profile	\N	Spam	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
118	18	1	profile	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
119	18	19	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
120	18	14	activity	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
121	18	15	profile	\N	Suspicious behavior	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
122	18	16	profile	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
123	14	7	profile	\N	Harassment	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
124	14	8	message	\N	Inappropriate content	pending	\N	2025-06-04 08:33:11.212119+03	2025-06-04 08:33:11.212119+03	\N	\N
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schema_migrations (id, version, name, applied_at) FROM stdin;
1	20250604220346	20250604220346_subscription_features_and_packages.sql	2025-06-04 22:07:05.097358+03
\.


--
-- Data for Name: subscription_features; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_features (id, package_id, feature_name, feature_description, created_at, premium_only, elite_only) FROM stdin;
37	\N	Exclusive Events	Access to exclusive virtual dating events	2025-06-01 15:14:23.23824+03	f	f
72	4	basic_matching	Basic matching with limited daily likes	2025-06-04 22:09:02.379791+03	f	f
73	4	profile_creation	Create and customize your profile	2025-06-04 22:09:02.379791+03	f	f
74	4	basic_search	Basic search filters	2025-06-04 22:09:02.379791+03	f	f
75	4	limited_messaging	Send messages to mutual matches	2025-06-04 22:09:02.379791+03	f	f
76	5	unlimited_likes	Unlimited likes and matches	2025-06-04 22:09:02.379791+03	f	f
77	5	advanced_search	Advanced search filters	2025-06-04 22:09:02.379791+03	f	f
78	5	read_receipts	See who read your messages	2025-06-04 22:09:02.379791+03	f	f
79	5	profile_boost	Boost your profile once a week	2025-06-04 22:09:02.379791+03	f	f
80	5	see_who_likes_you	See who liked your profile	2025-06-04 22:09:02.379791+03	f	f
81	5	priority_matching	Get priority in match results	2025-06-04 22:09:02.379791+03	f	f
82	6	all_premium_features	All Premium features included	2025-06-04 22:09:02.379791+03	f	f
83	6	unlimited_boosts	Unlimited profile boosts	2025-06-04 22:09:02.379791+03	f	f
84	6	incognito_mode	Browse profiles anonymously	2025-06-04 22:09:02.379791+03	f	f
85	6	message_priority	Your messages appear first	2025-06-04 22:09:02.379791+03	f	f
86	6	personal_matchmaker	Personalized matchmaking service	2025-06-04 22:09:02.379791+03	f	f
87	6	exclusive_events	Access to exclusive events	2025-06-04 22:09:02.379791+03	f	f
\.


--
-- Data for Name: subscription_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_packages (id, name, price, billing_interval, is_active, created_at, updated_at, description, duration_months, tier_level) FROM stdin;
5	Premium	19.99	monthly	t	2025-06-01 15:14:23.223743+03	2025-06-04 22:09:02.379791+03	Most popular - Enhanced features for better matching	1	Premium
6	Elite	29.99	monthly	t	2025-06-01 15:14:23.223743+03	2025-06-04 22:09:02.379791+03	Full access to all premium features	1	Elite
4	Basic	0.00	monthly	t	2025-06-01 15:14:23.223743+03	2025-06-05 21:51:09.194389+03	Essential features to get started	1	Basic
\.


--
-- Data for Name: subscription_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_transactions (id, subscription_id, amount, status, payment_method, created_at) FROM stdin;
2	2	29.99	completed	Account Balance	2025-06-04 08:46:25.910232+03
3	3	29.99	completed	Account Balance	2025-06-04 08:47:44.990021+03
4	4	29.99	completed	Account Balance	2025-06-04 09:06:10.877362+03
5	5	29.99	completed	Account Balance	2025-06-04 10:15:05.59947+03
6	6	29.99	completed	Account Balance	2025-06-04 10:15:07.453569+03
7	7	9.99	completed	Account Balance	2025-06-04 10:16:11.015658+03
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tickets (id, user_id, title, description, status, assigned_to, created_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, user_id, item_category, amount, status, created_at, updated_at, user_provided_reference, admin_notes, payable_item_id, currency, payment_country_id, payment_method_type_id, payment_method_id, payment_reference, description, payment_details, type) FROM stdin;
87	40	gift	5.99	completed	2025-06-05 08:04:23.639802+03	2025-06-05 08:04:23.639802+03	\N	\N	1	\N	\N	\N	\N	\N	Gift sent to user 41	{"payment_method": "site_balance"}	gift_sent
89	40	gift	9.99	completed	2025-06-05 09:43:25.429837+03	2025-06-05 09:43:25.429837+03	\N	\N	2	\N	\N	\N	\N	\N	Gift sent to user 41	{"payment_method": "site_balance"}	gift_sent
12	15	gift	101.00	pending_payment	2025-06-03 21:58:28.003552+03	2025-06-03 21:58:28.003552+03	\N	\N	1	\N	48	4	\N	\N	deposit	\N	gift_sent
13	15	gift	101.00	pending_payment	2025-06-03 21:59:40.647221+03	2025-06-03 21:59:40.647221+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
14	15	gift	90.00	pending_payment	2025-06-03 22:03:11.360421+03	2025-06-03 22:03:11.360421+03	\N	\N	1	\N	6	4	\N	\N	deposit	\N	gift_sent
15	15	gift	91.00	pending_payment	2025-06-03 22:07:56.069103+03	2025-06-03 22:07:56.069103+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
16	15	gift	101.00	pending_payment	2025-06-03 22:09:29.440922+03	2025-06-03 22:09:29.440922+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
18	15	gift	70.00	pending_payment	2025-06-03 22:13:31.724097+03	2025-06-03 22:13:31.724097+03	\N	\N	1	\N	4	1	\N	\N	deposit	\N	gift_sent
19	15	gift	99.00	pending_payment	2025-06-03 22:15:51.748077+03	2025-06-03 22:15:51.748077+03	\N	\N	1	\N	4	2	\N	\N	deposit	\N	gift_sent
20	15	gift	98.00	pending_payment	2025-06-03 22:17:37.418764+03	2025-06-03 22:17:37.418764+03	\N	\N	1	\N	3	1	\N	\N	deposit	\N	gift_sent
21	15	gift	97.00	pending_payment	2025-06-03 22:18:58.332969+03	2025-06-03 22:18:58.332969+03	\N	\N	1	\N	4	1	\N	\N	deposit	\N	gift_sent
49	15	deposit	100.00	declined	2025-06-04 08:03:36.94315+03	2025-06-04 08:12:13.60825+03	HGTFDRD		1	USD	7	41	\N	\N	deposit	\N	credit
22	15	gift	96.00	pending_payment	2025-06-03 22:22:00.489684+03	2025-06-03 22:22:00.489684+03	\N	\N	1	\N	4	1	\N	\N	deposit	\N	gift_sent
50	15	deposit	200.00	completed	2025-06-04 08:11:22.436046+03	2025-06-04 08:12:16.319261+03	HHTSTFSFT		1	USD	7	41	\N	\N	deposit	\N	credit
17	15	gift	100.00	completed	2025-06-03 22:11:23.495074+03	2025-06-03 22:24:12.653237+03	87GTDDGT		1	\N	1	1	\N	\N	deposit	\N	gift_sent
23	15	gift	1011.00	pending_payment	2025-06-03 22:24:52.430155+03	2025-06-03 22:24:52.430155+03	\N	\N	1	\N	13	24	\N	\N	deposit	\N	gift_sent
60	7	subscription	9.99	completed	2025-04-14 03:30:37.960343+03	2025-06-04 08:32:19.790608+03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	debit
24	15	gift	21.00	pending_payment	2025-06-03 22:26:51.369171+03	2025-06-03 22:26:51.369171+03	\N	\N	1	\N	4	1	\N	\N	deposit	\N	gift_sent
25	15	gift	22.00	pending_payment	2025-06-03 22:29:54.044444+03	2025-06-03 22:29:54.044444+03	\N	\N	1	\N	4	1	\N	\N	deposit	\N	gift_sent
26	15	gift	80.00	pending_payment	2025-06-04 05:04:31.25725+03	2025-06-04 05:04:31.25725+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
27	15	gift	90.00	pending_payment	2025-06-04 05:07:44.49363+03	2025-06-04 05:07:44.49363+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
28	15	gift	100.00	pending_payment	2025-06-04 05:14:31.894865+03	2025-06-04 05:14:31.894865+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
29	15	gift	100.00	pending_payment	2025-06-04 05:17:16.229082+03	2025-06-04 05:17:16.229082+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
30	15	gift	1009.00	pending_payment	2025-06-04 05:17:26.675536+03	2025-06-04 05:17:26.675536+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
31	15	gift	10.00	pending_payment	2025-06-04 05:27:38.905816+03	2025-06-04 05:27:38.905816+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
32	15	gift	10.00	pending_payment	2025-06-04 05:27:59.391708+03	2025-06-04 05:27:59.391708+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
33	15	gift	20.00	pending_payment	2025-06-04 05:29:12.323811+03	2025-06-04 05:29:12.323811+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
34	15	gift	2.00	pending_payment	2025-06-04 05:37:17.307593+03	2025-06-04 05:37:17.307593+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
35	15	gift	2.00	pending_payment	2025-06-04 05:37:23.217889+03	2025-06-04 05:37:23.217889+03	\N	\N	1	\N	7	41	\N	\N	deposit	\N	gift_sent
36	15	gift	122.00	pending_payment	2025-06-04 05:41:19.613929+03	2025-06-04 05:41:19.613929+03	\N	\N	1	\N	7	41	\N	\N	deposit	\N	gift_sent
37	15	gift	122.00	pending_payment	2025-06-04 05:41:24.895339+03	2025-06-04 05:41:24.895339+03	\N	\N	1	\N	7	3	\N	\N	deposit	\N	gift_sent
38	15	gift	122.00	completed	2025-06-04 05:45:21.418104+03	2025-06-04 05:45:57.07344+03	UITTTF		1	\N	7	3	\N	\N	deposit	\N	gift_sent
39	15	gift	101.00	completed	2025-06-04 05:46:48.125377+03	2025-06-04 05:47:51.102897+03	gTTHD76		1	\N	7	41	\N	\N	deposit	\N	gift_sent
40	15	gift	67.00	declined	2025-06-04 05:48:13.706765+03	2025-06-04 05:48:29.687934+03	676456g		1	\N	7	3	\N	\N	deposit	\N	gift_sent
44	15	deposit	100.00	pending_payment	2025-06-04 05:55:57.262292+03	2025-06-04 05:55:57.262292+03	\N	\N	1	KES	7	41	\N	\N	deposit	\N	credit
45	15	deposit	100.00	pending_payment	2025-06-04 05:58:42.859302+03	2025-06-04 05:58:42.859302+03	\N	\N	1	KES	7	41	\N	\N	deposit	\N	credit
46	15	deposit	100.00	completed	2025-06-04 06:01:11.596796+03	2025-06-04 06:06:28.585563+03	YYYHFDEF		1	KES	7	41	\N	\N	deposit	\N	credit
47	15	deposit	100.00	completed	2025-06-04 07:54:52.638093+03	2025-06-04 07:57:21.383003+03	UHAYGST		1	KES	7	41	\N	\N	deposit	\N	credit
48	15	deposit	100.00	completed	2025-06-04 08:02:00.151791+03	2025-06-04 08:02:34.193474+03	NUAHYSF		1	USD	7	41	\N	\N	deposit	\N	credit
66	15	subscription	19.99	completed	2025-04-11 13:44:36.913589+03	2025-06-04 08:32:19.790608+03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	debit
68	18	subscription	9.99	completed	2025-05-12 08:57:26.650818+03	2025-06-04 08:32:19.790608+03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	debit
69	7	gift	29.99	completed	2025-04-13 10:23:47.220301+03	2025-06-04 08:33:11.212119+03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	gift_sent
74	18	gift	9.99	completed	2025-04-13 00:22:42.948223+03	2025-06-04 08:33:11.212119+03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	gift_sent
76	15	subscription	9.99	completed	2025-05-20 04:59:11.977801+03	2025-06-04 08:33:11.212119+03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	debit
79	15	subscription	29.99	completed	2025-06-04 08:46:25.910232+03	2025-06-04 08:46:25.910232+03	PAID_FROM_BALANCE	Paid from account balance	6	USD	\N	\N	\N	\N	Subscription purchase: Elite (from balance)	\N	debit
80	15	subscription	29.99	completed	2025-06-04 08:47:44.990021+03	2025-06-04 08:47:44.990021+03	PAID_FROM_BALANCE	Paid from account balance	6	USD	\N	\N	\N	\N	Subscription purchase: Elite (from balance)	\N	debit
81	15	deposit	100.00	declined	2025-06-04 09:03:55.85237+03	2025-06-04 09:04:50.533316+03	MPESJSTC77		1	USD	7	41	\N	\N	deposit	\N	credit
82	15	subscription	29.99	completed	2025-06-04 09:06:10.877362+03	2025-06-04 09:06:10.877362+03	PAID_FROM_BALANCE	Paid from account balance	6	USD	\N	\N	\N	\N	Subscription purchase: Elite (from balance)	\N	debit
83	18	deposit	100.00	completed	2025-06-04 10:14:19.965447+03	2025-06-04 10:14:45.269005+03	HUSTSRAD		1	USD	7	41	\N	\N	deposit	\N	credit
84	18	subscription	29.99	completed	2025-06-04 10:15:05.59947+03	2025-06-04 10:15:05.59947+03	PAID_FROM_BALANCE	Paid from account balance	6	USD	\N	\N	\N	\N	Subscription purchase: Elite (from balance)	\N	debit
85	18	subscription	29.99	completed	2025-06-04 10:15:07.453569+03	2025-06-04 10:15:07.453569+03	PAID_FROM_BALANCE	Paid from account balance	6	USD	\N	\N	\N	\N	Subscription purchase: Elite (from balance)	\N	debit
86	18	subscription	9.99	completed	2025-06-04 10:16:11.015658+03	2025-06-04 10:16:11.015658+03	PAID_FROM_BALANCE	Paid from account balance	4	USD	\N	\N	\N	\N	Subscription purchase: Basic (from balance)	\N	debit
88	41	gift	19.99	completed	2025-06-05 08:25:19.096034+03	2025-06-05 08:25:19.096034+03	\N	\N	4	\N	\N	\N	\N	\N	Gift sent to user 40	{"payment_method": "site_balance"}	gift_sent
90	41	gift	9.99	completed	2025-06-05 21:19:46.778734+03	2025-06-05 21:19:46.778734+03	\N	\N	2	\N	\N	\N	\N	\N	Gift sent to user 40	{"payment_method": "site_balance"}	gift_sent
\.


--
-- Data for Name: user_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_activities (id, user_id, swipe_count, message_count, activity_date, created_at, updated_at) FROM stdin;
1	40	0	10	2025-06-05	2025-06-05 20:05:52.085814+03	2025-06-05 20:05:52.085814+03
11	41	0	10	2025-06-05	2025-06-05 20:15:46.126852+03	2025-06-05 20:15:46.126852+03
\.


--
-- Data for Name: user_balances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_balances (id, user_id, balance, created_at, updated_at) FROM stdin;
27	40	98.61	2025-06-05 07:49:51.838305+03	2025-06-05 09:43:25.429837+03
30	44	0.00	2025-06-05 10:52:09.062003+03	2025-06-05 10:52:09.062003+03
31	49	0.00	2025-06-05 19:22:28.267468+03	2025-06-05 19:22:28.267468+03
28	41	81.68	2025-06-05 07:49:51.838305+03	2025-06-05 21:19:46.778734+03
9	18	130.03	2025-06-04 10:14:04.203978+03	2025-06-04 10:14:45.255747+03
1	15	400.03	2025-06-03 19:53:39.792245+03	2025-06-04 08:12:16.312137+03
19	7	0.00	2025-06-04 20:41:29.262298+03	2025-06-04 20:41:29.262298+03
14	13	5.25	2025-06-04 20:41:29.262298+03	2025-06-04 20:41:52.87626+03
29	42	100.00	2025-06-05 07:49:51.838305+03	2025-06-05 07:49:51.838305+03
\.


--
-- Data for Name: user_gifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_gifts (id, sender_id, recipient_id, gift_item_id, message, is_anonymous, is_read, created_at, original_purchase_price, is_redeemed, redeemed_at, redeemed_value) FROM stdin;
5	41	40	4	Sending you a Golden Rose!	f	f	2025-06-05 08:25:19.096034	19.99	t	2025-06-05 08:35:32.646601	14.59
4	40	41	1	Sending you a Virtual Rose!	f	f	2025-06-05 08:04:23.639802	5.99	t	2025-06-05 08:44:36.978562	4.37
6	40	41	2	Sending you a Digital Chocolate Box!	f	f	2025-06-05 09:43:25.429837	9.99	t	2025-06-05 09:43:44.84799	7.29
7	41	40	2	Sending you a Digital Chocolate Box!	f	f	2025-06-05 21:19:46.778734	9.99	f	\N	\N
\.


--
-- Data for Name: user_photos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_photos (id, user_id, photo_url, is_profile_picture, order_index, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_subscriptions (id, user_id, package_id, status, start_date, end_date, auto_renew, payment_method_id, created_at, updated_at, tier_level) FROM stdin;
2	15	6	cancelled	2025-06-04 08:46:25.910232+03	2025-06-04 08:47:44.990021+03	f	79	2025-06-04 08:46:25.910232+03	2025-06-04 08:47:44.990021+03	Basic
3	15	6	cancelled	2025-06-04 08:47:44.990021+03	2025-06-04 09:06:10.877362+03	f	80	2025-06-04 08:47:44.990021+03	2025-06-04 09:06:10.877362+03	Basic
4	15	6	active	2025-06-04 09:06:10.877362+03	2025-07-04 09:06:10.912+03	t	82	2025-06-04 09:06:10.877362+03	2025-06-04 09:06:10.877362+03	Basic
5	18	6	cancelled	2025-06-04 10:15:05.59947+03	2025-06-04 10:15:07.453569+03	f	84	2025-06-04 10:15:05.59947+03	2025-06-04 10:15:07.453569+03	Basic
6	18	6	cancelled	2025-06-04 10:15:07.453569+03	2025-06-04 10:16:11.015658+03	f	85	2025-06-04 10:15:07.453569+03	2025-06-04 10:16:11.015658+03	Basic
7	18	4	active	2025-06-04 10:16:11.015658+03	2025-07-04 10:16:11.098+03	t	86	2025-06-04 10:16:11.015658+03	2025-06-04 10:16:11.015658+03	Basic
8	7	5	active	2025-06-04 22:13:26.657115+03	2025-07-04 22:13:26.657115+03	t	\N	2025-06-04 22:13:26.657115+03	2025-06-04 22:13:26.657115+03	Premium
20	40	4	active	2025-06-05 07:49:52.72+03	2026-06-05 07:49:52.72+03	t	\N	2025-06-05 07:49:51.838305+03	2025-06-05 07:49:51.838305+03	Basic
21	41	5	active	2025-06-05 07:49:52.9+03	2026-06-05 07:49:52.9+03	t	\N	2025-06-05 07:49:51.838305+03	2025-06-05 07:49:51.838305+03	Premium
22	42	6	active	2025-06-05 07:49:53.095+03	2026-06-05 07:49:53.095+03	t	\N	2025-06-05 07:49:51.838305+03	2025-06-05 07:49:51.838305+03	Elite
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, role, is_active, profile_complete, created_at, is_suspended, suspension_reason, suspension_end_date, updated_at, suspended_at, country_id, phone, phone_verified, email_verification_token, is_email_verified, subscription_tier, message_count_today, last_message_date, swipe_count_today, last_swipe_date) FROM stdin;
40	basic@test.com	$2a$10$CZRJruGgwIjM0g2x4TOu7.r0.sJh98A1iMU0FXTMVyRYre8fPjSXO	user	t	t	2025-06-05 07:49:51.838305	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	t	Basic	0	2025-06-06	0	2025-06-06
18	sharon@mail.com	$2a$10$WHkqaerBV28TedYQRoFhNeg1QA3JH6BJvAKkCUKGBYzqrntbP65U2	user	t	t	2025-06-02 15:15:55.218437	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	t	Basic	0	\N	0	\N
43	admin@test.com	$2a$10$a41p9DmkF1e.NkNkcMPZTOcRTlmy0EthJV9YpNjLMBtL4EvajBi4W	admin	t	f	2025-06-05 07:49:51.838305	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	f	Basic	0	\N	0	\N
45	ronoemily41@gmail.com	$2a$10$Iz5mHo/EzkMLVl9tqJDYiOyhBHu5wa9XqCnnxX2H8yNYR51XNiUD.	user	t	f	2025-06-05 09:55:15.955331	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	f	Basic	0	\N	0	\N
46	somerandommail676@gmail.com	$2a$10$k/2c84bb0wm4ZLS5IWTLwufi2QjRNApjZTUlZAYG3/g3kLp8cmGuy	user	t	f	2025-06-05 09:56:44.909191	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	f	Basic	0	\N	0	\N
47	rteanllc@gmail.com	$2a$10$SN894KCQ2nm7N6hDXiC74eeg8K9NAbYuhdM9eLVTHpfJOYWL0WOAW	user	t	f	2025-06-05 10:04:25.021498	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	f	Basic	0	\N	0	\N
48	alalalala@gmail.com	$2a$10$bUVTHqc4uUDu3ZSgRemCAukSSNsQtDQUDEJ5tGUjijyEXwv35JEOy	user	t	f	2025-06-05 10:06:42.94676	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	f	Basic	0	\N	0	\N
42	elite@test.com	$2a$10$lKCoegoSto9c7btprg9vUu3AKvr4J58O1Dq.7O44pOS22S0ig8K8C	user	t	t	2025-06-05 07:49:51.838305	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	t	Basic	0	\N	0	\N
49	user@mail.com	$2a$10$I2zKHB./EBUnd.C/kD2A3OBPsICzMxoCk49KHgUJyLopU9/QWhMWC	user	t	t	2025-06-05 19:19:06.972275	f	\N	\N	2025-06-06 12:55:56.643651	\N	7	\N	f	\N	t	Basic	0	\N	0	\N
7	test@example.com	$2a$10$6FVksvNDwRaJJ8/CcAmla.19Ypgd2SFi3a/B/yQ6KJsclmUZB4TmW	user	t	f	2025-05-31 22:16:29.051266	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	f	Basic	0	\N	0	\N
50	testuser3@mail.com	$2a$10$T.FsfMEOqcs06JF6x1rC0ON/.lk8txXUeT3qIrU0NxYNp.wpvuDuS	user	t	f	2025-06-05 19:29:46.473065	f	\N	\N	2025-06-06 12:55:56.643651	\N	7	\N	f	\N	t	Basic	0	\N	0	\N
51	testuser4@mail.com	$2a$10$xoZKeSJA1TsQmrhyxCwSoeOiPNUV9LHlNTpmO.NP5uQhBMXS9M3Na	user	t	f	2025-06-05 19:33:20.015949	f	\N	\N	2025-06-06 12:55:56.643651	\N	7	\N	f	\N	t	Basic	0	\N	0	\N
44	ronoemily415@gmail.com	$2a$10$ZcwEgYTZtiTOoLUS7rdDdOAM5O8jQQAXOtUp6bMt6t7zGXr0oPqYO	user	t	t	2025-06-05 09:44:43.63275	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	t	Basic	0	\N	0	\N
41	premium@test.com	$2a$10$ybgRoJdGJfyQ4QOnwaHfKu5Ky5el1lEudGsVPrsp8GVZSsFAbQUiK	user	t	t	2025-06-05 07:49:51.838305	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	t	Basic	0	2025-06-05	0	2025-06-05
15	cherono@gmail.com	$2a$10$hK1k/3/wh42g3v2S/pcYoeEQKz3t3jip8KENk4uODDMIukgv.EIiC	user	t	t	2025-06-01 16:55:23.788275	f	\N	\N	2025-06-06 12:55:56.643651	\N	39	\N	f	\N	t	Basic	0	\N	0	\N
13	admin@meetcute.com	$2a$10$m1D0ZJws4pb3NY8297AcWOq24vuplPgB.dSMSZiCVvt1YbDmIF8HO	admin	t	t	2025-06-01 10:47:34.958218	f	\N	\N	2025-06-06 12:55:56.643651	\N	\N	\N	f	\N	t	Basic	0	\N	0	\N
\.


--
-- Data for Name: withdrawal_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.withdrawal_requests (id, user_id, amount, status, payment_details, processed_by, created_at, updated_at, processed_at) FROM stdin;
2	15	100.00	approved	Paypal: mar@mail.com	13	2025-06-04 16:20:50.942692+03	2025-06-04 16:27:19.60482+03	2025-06-04 16:27:19.60482+03
1	15	50.00	approved	hhj	13	2025-06-04 16:20:21.898889+03	2025-06-04 16:34:03.755011+03	2025-06-04 16:34:03.755011+03
3	15	100.00	rejected	ano	13	2025-06-04 16:34:49.603218+03	2025-06-04 16:45:33.274626+03	2025-06-04 16:45:33.274626+03
4	15	60.00	approved	hjhj	13	2025-06-04 16:46:22.625906+03	2025-06-04 22:43:12.4513+03	2025-06-04 22:43:12.4513+03
\.


--
-- Name: admin_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_actions_id_seq', 1, false);


--
-- Name: admin_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_logs_id_seq', 10, true);


--
-- Name: anonymous_browsing_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.anonymous_browsing_sessions_id_seq', 1, false);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: countries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.countries_id_seq', 68, true);


--
-- Name: error_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.error_logs_id_seq', 1, false);


--
-- Name: feature_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feature_permissions_id_seq', 40, true);


--
-- Name: gift_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gift_items_id_seq', 5, true);


--
-- Name: gift_tiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gift_tiers_id_seq', 6, true);


--
-- Name: likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.likes_id_seq', 75, true);


--
-- Name: matches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.matches_id_seq', 9, true);


--
-- Name: message_limits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_limits_id_seq', 3, true);


--
-- Name: message_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_reactions_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_methods_id_seq', 41, true);


--
-- Name: profile_boosts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.profile_boosts_id_seq', 1, false);


--
-- Name: profile_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.profile_views_id_seq', 1, false);


--
-- Name: reported_content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reported_content_id_seq', 124, true);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.schema_migrations_id_seq', 1, true);


--
-- Name: subscription_features_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_features_id_seq', 87, true);


--
-- Name: subscription_packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_packages_id_seq', 12, true);


--
-- Name: subscription_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subscription_transactions_id_seq', 7, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 90, true);


--
-- Name: user_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_activities_id_seq', 20, true);


--
-- Name: user_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_balances_id_seq', 31, true);


--
-- Name: user_gifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_gifts_id_seq', 7, true);


--
-- Name: user_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_photos_id_seq', 10, true);


--
-- Name: user_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_subscriptions_id_seq', 22, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 51, true);


--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.withdrawal_requests_id_seq', 4, true);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: anonymous_browsing_sessions anonymous_browsing_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anonymous_browsing_sessions
    ADD CONSTRAINT anonymous_browsing_sessions_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: countries countries_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_code_key UNIQUE (code);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: country_payment_methods country_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.country_payment_methods
    ADD CONSTRAINT country_payment_methods_pkey PRIMARY KEY (country_id, payment_method_id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: feature_permissions feature_permissions_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_permissions
    ADD CONSTRAINT feature_permissions_feature_key_key UNIQUE (feature_key);


--
-- Name: feature_permissions feature_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_permissions
    ADD CONSTRAINT feature_permissions_pkey PRIMARY KEY (id);


--
-- Name: gift_items gift_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_items
    ADD CONSTRAINT gift_items_pkey PRIMARY KEY (id);


--
-- Name: gift_tiers gift_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_tiers
    ADD CONSTRAINT gift_tiers_name_key UNIQUE (name);


--
-- Name: gift_tiers gift_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_tiers
    ADD CONSTRAINT gift_tiers_pkey PRIMARY KEY (id);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: likes likes_user_id_liked_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_liked_user_id_key UNIQUE (user_id, liked_user_id);


--
-- Name: likes_visibility likes_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes_visibility
    ADD CONSTRAINT likes_visibility_pkey PRIMARY KEY (user_id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: matches matches_user1_id_user2_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user1_id_user2_id_key UNIQUE (user1_id, user2_id);


--
-- Name: message_limits message_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_limits
    ADD CONSTRAINT message_limits_pkey PRIMARY KEY (id);


--
-- Name: message_limits message_limits_subscription_level_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_limits
    ADD CONSTRAINT message_limits_subscription_level_key UNIQUE (subscription_level);


--
-- Name: message_reactions message_reactions_message_id_user_id_emoji_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- Name: message_status message_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_code_key UNIQUE (code);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: profile_boosts profile_boosts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_boosts
    ADD CONSTRAINT profile_boosts_pkey PRIMARY KEY (id);


--
-- Name: profile_views profile_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_views
    ADD CONSTRAINT profile_views_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: reported_content reported_content_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reported_content
    ADD CONSTRAINT reported_content_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_version_key UNIQUE (version);


--
-- Name: subscription_features subscription_features_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_features
    ADD CONSTRAINT subscription_features_pkey PRIMARY KEY (id);


--
-- Name: subscription_packages subscription_packages_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_packages
    ADD CONSTRAINT subscription_packages_name_key UNIQUE (name);


--
-- Name: subscription_packages subscription_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_packages
    ADD CONSTRAINT subscription_packages_pkey PRIMARY KEY (id);


--
-- Name: subscription_transactions subscription_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_transactions
    ADD CONSTRAINT subscription_transactions_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: profile_views unique_view_per_day; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_views
    ADD CONSTRAINT unique_view_per_day UNIQUE (viewer_id, viewed_user_id, viewed_date);


--
-- Name: user_activities user_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_pkey PRIMARY KEY (id);


--
-- Name: user_activities user_activities_user_id_activity_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_user_id_activity_date_key UNIQUE (user_id, activity_date);


--
-- Name: user_balances user_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_balances
    ADD CONSTRAINT user_balances_pkey PRIMARY KEY (id);


--
-- Name: user_balances user_balances_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_balances
    ADD CONSTRAINT user_balances_user_id_unique UNIQUE (user_id);


--
-- Name: user_gifts user_gifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gifts
    ADD CONSTRAINT user_gifts_pkey PRIMARY KEY (id);


--
-- Name: user_photos user_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_photos
    ADD CONSTRAINT user_photos_pkey PRIMARY KEY (id);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_logs_admin_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs USING btree (admin_id);


--
-- Name: idx_admin_logs_target_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_logs_target_user_id ON public.admin_logs USING btree (target_user_id);


--
-- Name: idx_countries_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_countries_code ON public.countries USING btree (code);


--
-- Name: idx_country_payment_methods_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_country_payment_methods_country ON public.country_payment_methods USING btree (country_id);


--
-- Name: idx_country_payment_methods_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_country_payment_methods_payment ON public.country_payment_methods USING btree (payment_method_id);


--
-- Name: idx_likes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_likes_created_at ON public.likes USING btree (created_at);


--
-- Name: idx_likes_liked_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_likes_liked_user_id ON public.likes USING btree (liked_user_id);


--
-- Name: idx_likes_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_likes_user_id ON public.likes USING btree (user_id);


--
-- Name: idx_matches_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_created_at ON public.matches USING btree (created_at);


--
-- Name: idx_matches_user1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_user1 ON public.matches USING btree (user1_id);


--
-- Name: idx_matches_user1_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_user1_id ON public.matches USING btree (user1_id);


--
-- Name: idx_matches_user2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_user2 ON public.matches USING btree (user2_id);


--
-- Name: idx_matches_user2_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_user2_id ON public.matches USING btree (user2_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_payment_methods_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_methods_code ON public.payment_methods USING btree (code);


--
-- Name: idx_profile_views_viewed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profile_views_viewed_at ON public.profile_views USING btree (viewed_at);


--
-- Name: idx_profile_views_viewer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profile_views_viewer_id ON public.profile_views USING btree (viewer_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_reported_content_reported_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reported_content_reported_user ON public.reported_content USING btree (reported_user_id);


--
-- Name: idx_reported_content_reporter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reported_content_reporter ON public.reported_content USING btree (reporter_id);


--
-- Name: idx_reported_content_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reported_content_status ON public.reported_content USING btree (status);


--
-- Name: idx_reported_content_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reported_content_type ON public.reported_content USING btree (type);


--
-- Name: idx_subscription_features_package; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_features_package ON public.subscription_features USING btree (package_id);


--
-- Name: idx_subscription_packages_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_packages_active ON public.subscription_packages USING btree (is_active);


--
-- Name: idx_subscription_packages_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_packages_tier ON public.subscription_packages USING btree (tier_level);


--
-- Name: idx_subscription_transactions_subscription; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscription_transactions_subscription ON public.subscription_transactions USING btree (subscription_id);


--
-- Name: idx_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at);


--
-- Name: idx_transactions_item_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_item_category ON public.transactions USING btree (item_category);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (item_category);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: idx_user_activities_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_activities_user_date ON public.user_activities USING btree (user_id, activity_date);


--
-- Name: idx_user_balances_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_balances_user_id ON public.user_balances USING btree (user_id);


--
-- Name: idx_user_photos_profile_picture; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_photos_profile_picture ON public.user_photos USING btree (user_id) WHERE (is_profile_picture = true);


--
-- Name: idx_user_photos_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_photos_user_id ON public.user_photos USING btree (user_id);


--
-- Name: idx_user_subscriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions USING btree (status);


--
-- Name: idx_user_subscriptions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions USING btree (user_id);


--
-- Name: idx_users_is_suspended; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_is_suspended ON public.users USING btree (is_suspended);


--
-- Name: idx_users_subscription_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_subscription_tier ON public.users USING btree (subscription_tier);


--
-- Name: idx_withdrawal_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests USING btree (status);


--
-- Name: idx_withdrawal_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawal_requests_user_id ON public.withdrawal_requests USING btree (user_id);


--
-- Name: user_photos enforce_max_photos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_max_photos BEFORE INSERT ON public.user_photos FOR EACH ROW EXECUTE FUNCTION public.check_max_photos();


--
-- Name: conversation_participants update_conversation_participants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conversation_participants_updated_at BEFORE UPDATE ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: country_payment_methods update_country_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_country_payment_methods_updated_at BEFORE UPDATE ON public.country_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription_packages update_subscription_packages_modtime; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_subscription_packages_modtime BEFORE UPDATE ON public.subscription_packages FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: user_balances update_user_balances_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_balances_timestamp BEFORE UPDATE ON public.user_balances FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: admin_actions admin_actions_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: admin_actions admin_actions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: admin_logs admin_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: anonymous_browsing_sessions anonymous_browsing_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anonymous_browsing_sessions
    ADD CONSTRAINT anonymous_browsing_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_last_read_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: country_payment_methods country_payment_methods_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.country_payment_methods
    ADD CONSTRAINT country_payment_methods_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE;


--
-- Name: country_payment_methods country_payment_methods_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.country_payment_methods
    ADD CONSTRAINT country_payment_methods_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE CASCADE;


--
-- Name: messages fk_conversation; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: transactions fk_transactions_country_payment_method_config; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_country_payment_method_config FOREIGN KEY (payment_country_id, payment_method_id) REFERENCES public.country_payment_methods(country_id, payment_method_id);


--
-- Name: transactions fk_transactions_payment_country; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_payment_country FOREIGN KEY (payment_country_id) REFERENCES public.countries(id);


--
-- Name: transactions fk_transactions_payment_method_type; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_payment_method_type FOREIGN KEY (payment_method_type_id) REFERENCES public.payment_methods(id);


--
-- Name: gift_items gift_items_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gift_items
    ADD CONSTRAINT gift_items_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.gift_tiers(id);


--
-- Name: likes likes_liked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_liked_user_id_fkey FOREIGN KEY (liked_user_id) REFERENCES public.users(id);


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: likes_visibility likes_visibility_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes_visibility
    ADD CONSTRAINT likes_visibility_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: matches matches_user1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES public.users(id);


--
-- Name: matches matches_user2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES public.users(id);


--
-- Name: message_reactions message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_status message_status_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_status message_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_status
    ADD CONSTRAINT message_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profile_boosts profile_boosts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_boosts
    ADD CONSTRAINT profile_boosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: profile_views profile_views_viewed_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_views
    ADD CONSTRAINT profile_views_viewed_user_id_fkey FOREIGN KEY (viewed_user_id) REFERENCES public.users(id);


--
-- Name: profile_views profile_views_viewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_views
    ADD CONSTRAINT profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.users(id);


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reported_content reported_content_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reported_content
    ADD CONSTRAINT reported_content_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reported_content reported_content_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reported_content
    ADD CONSTRAINT reported_content_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reported_content reported_content_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reported_content
    ADD CONSTRAINT reported_content_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_features subscription_features_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_features
    ADD CONSTRAINT subscription_features_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.subscription_packages(id) ON DELETE CASCADE;


--
-- Name: subscription_transactions subscription_transactions_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_transactions
    ADD CONSTRAINT subscription_transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tickets tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_activities user_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_balances user_balances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_balances
    ADD CONSTRAINT user_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_gifts user_gifts_gift_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gifts
    ADD CONSTRAINT user_gifts_gift_item_id_fkey FOREIGN KEY (gift_item_id) REFERENCES public.gift_items(id);


--
-- Name: user_gifts user_gifts_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gifts
    ADD CONSTRAINT user_gifts_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: user_gifts user_gifts_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_gifts
    ADD CONSTRAINT user_gifts_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: user_photos user_photos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_photos
    ADD CONSTRAINT user_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.subscription_packages(id) ON DELETE RESTRICT;


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id);


--
-- Name: withdrawal_requests withdrawal_requests_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
-- Name: withdrawal_requests withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO postgres;


--
-- Name: TABLE admin_actions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_actions TO wiseman;


--
-- Name: SEQUENCE admin_actions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.admin_actions_id_seq TO wiseman;


--
-- Name: TABLE admin_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_logs TO wiseman;


--
-- Name: SEQUENCE admin_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.admin_logs_id_seq TO wiseman;


--
-- Name: TABLE gift_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.gift_items TO wiseman;


--
-- Name: SEQUENCE gift_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.gift_items_id_seq TO wiseman;


--
-- Name: TABLE likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.likes TO wiseman;


--
-- Name: SEQUENCE likes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.likes_id_seq TO wiseman;


--
-- Name: TABLE matches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.matches TO wiseman;


--
-- Name: SEQUENCE matches_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.matches_id_seq TO wiseman;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO wiseman;


--
-- Name: TABLE reported_content; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reported_content TO wiseman;


--
-- Name: SEQUENCE reported_content_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.reported_content_id_seq TO wiseman;


--
-- Name: TABLE tickets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tickets TO wiseman;


--
-- Name: SEQUENCE tickets_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tickets_id_seq TO wiseman;


--
-- Name: TABLE transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transactions TO wiseman;


--
-- Name: SEQUENCE transactions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.transactions_id_seq TO wiseman;


--
-- Name: TABLE user_gifts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_gifts TO wiseman;


--
-- Name: SEQUENCE user_gifts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_gifts_id_seq TO wiseman;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO wiseman;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO wiseman;


--
-- PostgreSQL database dump complete
--

