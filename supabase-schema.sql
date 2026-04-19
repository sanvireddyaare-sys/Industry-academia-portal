-- Supabase schema for Industry Academia Portal
create table if not exists profiles (
    id uuid primary key,
    name text,
    email text,
    phone text,
    role text,
    organization text,
    college text,
    resume_url text,
    last_test_score int,
    created_at timestamptz default now()
);
create table if not exists projects (
    id bigserial primary key,
    title text not null,
    description text,
    deadline date,
    company_id uuid references profiles(id) on delete set null,
    created_at timestamptz default now()
);
create table if not exists applications (
    id bigserial primary key,
    project_id bigint references projects(id) on delete cascade,
    student_id uuid references profiles(id) on delete cascade,
    status text default 'Pending',
    submission_link text,
    submission_description text,
    submission_file_url text,
    feedback text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
create table if not exists courses (
    id bigserial primary key,
    title text not null,
    description text,
    materials_url text,
    created_at timestamptz default now()
);
create table if not exists enrollments (
    id bigserial primary key,
    course_id bigint references courses(id) on delete cascade,
    student_id uuid references profiles(id) on delete cascade,
    progress int default 0,
    enrolled_at timestamptz default now(),
    unique(course_id, student_id)
);
create table if not exists tests (
    id bigserial primary key,
    title text not null,
    description text,
    created_at timestamptz default now()
);
create table if not exists questions (
    id bigserial primary key,
    test_id bigint references tests(id) on delete cascade,
    question text not null,
    options jsonb not null,
    correct_answer text not null,
    created_at timestamptz default now()
);
create table if not exists results (
    id bigserial primary key,
    test_id bigint references tests(id) on delete cascade,
    student_id uuid references profiles(id) on delete cascade,
    score int,
    created_at timestamptz default now(),
    unique(test_id, student_id)
);
create table if not exists events (
    id bigserial primary key,
    title text not null,
    description text,
    date timestamptz,
    duration int,
    link text,
    capacity int,
    organizer_id uuid references profiles(id) on delete set null,
    organizer_type text,
    created_at timestamptz default now()
);
create table if not exists event_registrations (
    id bigserial primary key,
    event_id bigint references events(id) on delete cascade,
    user_id uuid references profiles(id) on delete cascade,
    registered_at timestamptz default now(),
    unique(event_id, user_id)
);
create table if not exists event_attendance (
    id bigserial primary key,
    event_id bigint references events(id) on delete cascade,
    user_id uuid references profiles(id) on delete cascade,
    attended_at timestamptz default now(),
    unique(event_id, user_id)
);
create table if not exists mentor_profiles (
    id bigserial primary key,
    user_id uuid references profiles(id) on delete cascade,
    name text,
    organization text,
    bio text,
    expertise text,
    availability_hours int,
    goals text,
    created_at timestamptz default now()
);
create table if not exists mentorship_requests (
    id bigserial primary key,
    student_user_id uuid references profiles(id) on delete cascade,
    mentor_user_id uuid references profiles(id) on delete cascade,
    expertise_area text,
    message text,
    status text default 'pending',
    created_at timestamptz default now(),
    unique(student_user_id, mentor_user_id)
);
create table if not exists mentorship_messages (
    id bigserial primary key,
    mentorship_request_id bigint references mentorship_requests(id) on delete cascade,
    sender_id uuid references profiles(id) on delete set null,
    content text,
    created_at timestamptz default now()
);
create table if not exists interviews (
    id bigserial primary key,
    student_id uuid references profiles(id) on delete set null,
    company_id uuid references profiles(id) on delete set null,
    date date,
    time text,
    link text,
    created_at timestamptz default now()
);
create table if not exists portfolio (
    id bigserial primary key,
    student_id uuid references profiles(id) on delete cascade,
    title text,
    description text,
    link text,
    created_at timestamptz default now()
);
create table if not exists posts (
    id bigserial primary key,
    user_id uuid references profiles(id) on delete cascade,
    title text,
    content text,
    created_at timestamptz default now()
);
create table if not exists comments (
    id bigserial primary key,
    post_id bigint references posts(id) on delete cascade,
    user_id uuid references profiles(id) on delete cascade,
    content text,
    created_at timestamptz default now()
);
create table if not exists ratings (
    id bigserial primary key,
    user_id uuid references profiles(id) on delete cascade,
    company_id uuid references profiles(id) on delete cascade,
    rating int,
    review text,
    created_at timestamptz default now()
);
create table if not exists notifications (
    id bigserial primary key,
    user_id uuid references profiles(id) on delete cascade,
    type text,
    title text,
    message text,
    is_read boolean default false,
    created_at timestamptz default now()
);
create table if not exists hackathons (
    id bigserial primary key,
    title text not null,
    description text,
    created_at timestamptz default now()
);
create table if not exists submissions (
    id bigserial primary key,
    hackathon_id bigint references hackathons(id) on delete cascade,
    student_id uuid references profiles(id) on delete cascade,
    score int default 0,
    submitted_at timestamptz default now()
);
