-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.announcements (
  id bigint NOT NULL DEFAULT nextval('announcements_id_seq'::regclass),
  course_class_id bigint NOT NULL,
  user_id integer NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  type text DEFAULT 'stream'::text CHECK (type = ANY (ARRAY['stream'::text, 'assignment'::text, 'material'::text])),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_course_class_id_fkey FOREIGN KEY (course_class_id) REFERENCES public.course_classes(id),
  CONSTRAINT announcements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.assignments (
  id integer NOT NULL DEFAULT nextval('assignments_id_seq'::regclass),
  class_id integer,
  title character varying,
  description text,
  file_url text,
  deadline timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  user_id integer,
  course_class_id integer,
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.course_classes(id),
  CONSTRAINT assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT assignments_course_class_id_fkey FOREIGN KEY (course_class_id) REFERENCES public.course_classes(id)
);
CREATE TABLE public.attendance (
  id integer NOT NULL DEFAULT nextval('attendance_id_seq'::regclass),
  enrollment_id integer,
  class1 boolean,
  class2 boolean,
  class3 boolean,
  class4 boolean,
  class5 boolean,
  class6 boolean,
  class7 boolean,
  class8 boolean,
  class9 boolean,
  class10 boolean,
  class11 boolean,
  class12 boolean,
  class13 boolean,
  class14 boolean,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id)
);
CREATE TABLE public.course_classes (
  id integer NOT NULL DEFAULT nextval('course_classes_id_seq'::regclass),
  course_id integer,
  section integer,
  day_slot character varying,
  room_no character varying,
  faculty_id integer,
  class_type USER-DEFINED,
  time_slot character varying,
  seats integer,
  filled_seats bigint DEFAULT '0'::bigint,
  semester_id bigint,
  CONSTRAINT course_classes_pkey PRIMARY KEY (id),
  CONSTRAINT course_classes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_classes_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.users(id),
  CONSTRAINT course_classes_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.courses (
  id integer NOT NULL DEFAULT nextval('courses_id_seq'::regclass),
  course_code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  dept_id integer,
  credit real,
  prerequisite_id integer,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(dept_id),
  CONSTRAINT courses_prerequisite_id_fkey FOREIGN KEY (prerequisite_id) REFERENCES public.courses(id)
);
CREATE TABLE public.departments (
  dept_id integer NOT NULL DEFAULT nextval('departments_id_seq'::regclass),
  name character varying NOT NULL,
  chair_id integer,
  tag character varying NOT NULL UNIQUE,
  CONSTRAINT departments_pkey PRIMARY KEY (dept_id),
  CONSTRAINT departments_chair_id_fkey FOREIGN KEY (chair_id) REFERENCES public.users(id)
);
CREATE TABLE public.enrollments (
  id integer NOT NULL DEFAULT nextval('enrollments_id_seq'::regclass),
  class_id integer,
  student_id integer,
  score bigint CHECK (score > '-1'::integer AND score < 101),
  grade double precision,
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.course_classes(id),
  CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id)
);
CREATE TABLE public.faculty (
  user_id integer NOT NULL,
  faculty_code character varying UNIQUE,
  dept_id integer,
  designation character varying,
  joined_at bigint,
  office_room character varying,
  CONSTRAINT faculty_pkey PRIMARY KEY (user_id),
  CONSTRAINT faculty_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT faculty_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(dept_id),
  CONSTRAINT faculty_joined_at_fkey FOREIGN KEY (joined_at) REFERENCES public.semesters(id)
);
CREATE TABLE public.logs (
  id integer NOT NULL DEFAULT nextval('logs_id_seq'::regclass),
  user_id integer,
  action text,
  performed_at timestamp without time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.materials (
  id bigint NOT NULL DEFAULT nextval('materials_id_seq'::regclass),
  course_class_id integer NOT NULL,
  user_id integer NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT materials_pkey PRIMARY KEY (id),
  CONSTRAINT materials_course_class_id_fkey FOREIGN KEY (course_class_id) REFERENCES public.course_classes(id),
  CONSTRAINT materials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.office_hours (
  id bigint NOT NULL DEFAULT nextval('office_hours_id_seq'::regclass),
  faculty_id integer NOT NULL,
  day text NOT NULL CHECK (day = ANY (ARRAY['Sun'::text, 'Mon'::text, 'Tue'::text, 'Wed'::text, 'Thu'::text, 'Fri'::text, 'Sat'::text])),
  start_time text NOT NULL,
  end_time text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT office_hours_pkey PRIMARY KEY (id),
  CONSTRAINT office_hours_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'faculty'::text, 'student'::text])),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.semesters (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  name character varying UNIQUE,
  CONSTRAINT semesters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.service_requests (
  id integer NOT NULL DEFAULT nextval('service_requests_id_seq'::regclass),
  user_id integer,
  request_type character varying,
  description text,
  file_url text,
  status character varying DEFAULT 'Pending'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT service_requests_pkey PRIMARY KEY (id),
  CONSTRAINT service_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.staff (
  user_id integer NOT NULL,
  permission_level integer DEFAULT 1,
  staff_code bigint,
  CONSTRAINT staff_pkey PRIMARY KEY (user_id),
  CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.students (
  user_id integer NOT NULL,
  student_code character varying UNIQUE,
  dept_id integer,
  credits integer DEFAULT 0,
  enrolled_at bigint,
  CONSTRAINT students_pkey PRIMARY KEY (user_id),
  CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT students_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.departments(dept_id),
  CONSTRAINT students_enrolled_at_fkey FOREIGN KEY (enrolled_at) REFERENCES public.semesters(id)
);
CREATE TABLE public.submissions (
  id integer NOT NULL DEFAULT nextval('submissions_id_seq'::regclass),
  assignment_id integer,
  student_id integer,
  submitted_at timestamp without time zone DEFAULT now(),
  file_url text,
  reviewed boolean DEFAULT false,
  grade character varying,
  feedback text,
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id)
);
CREATE TABLE public.system_config (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  current_semester_id integer,
  advising_start_date timestamp with time zone,
  advising_end_date timestamp with time zone,
  add_drop_deadline timestamp with time zone,
  grade_submission_deadline timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by integer,
  CONSTRAINT system_config_pkey PRIMARY KEY (id),
  CONSTRAINT system_config_current_semester_id_fkey FOREIGN KEY (current_semester_id) REFERENCES public.semesters(id),
  CONSTRAINT system_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  email character varying NOT NULL UNIQUE,
  full_name character varying,
  role character varying CHECK (role::text = ANY (ARRAY['student'::character varying, 'faculty'::character varying, 'staff'::character varying, 'admin'::character varying]::text[])),
  created_at timestamp without time zone DEFAULT now(),
  first_login boolean DEFAULT true,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);