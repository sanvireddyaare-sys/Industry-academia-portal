const SUPABASE_URL = 'https://mrytsgemfksbqlsxmxkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeXRzZ2VtZmtzYnFsc3hteGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDg3NjMsImV4cCI6MjA5MTEyNDc2M30.B1ipLC0AjHgUBCx5BadMvc5WootlsF3JWWi7qeMWwpo';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let profilePageListenersBound = false;

function findAlert() {
    return document.getElementById('pageAlert') || document.getElementById('errorAlert') || document.getElementById('successAlert') || document.getElementById('infoAlert');
}

function clearAlert() {
    const alert = findAlert();
    if (!alert) return;
    alert.textContent = '';
    alert.className = 'alert';
}

function showAlert(message, type = 'info', duration = 4000) {
    const alert = findAlert();
    if (!alert) {
        console.warn('No alert container found for message:', message);
        return;
    }

    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    if (duration > 0) {
        clearTimeout(alert._dismissTimeout);
        alert._dismissTimeout = setTimeout(() => {
            alert.classList.remove('show');
        }, duration);
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function validatePhone(phone) {
    return /^[0-9]{10}$/.test(phone.replace(/[^0-9]/g, ''));
}

async function handleLogin(event) {
    event.preventDefault();
    clearAlert();

    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (!validateEmail(email)) {
        showAlert('Please enter a valid email address.', 'error');
        return;
    }

    if (!validatePassword(password)) {
        showAlert('Password must be at least 6 characters.', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            showAlert(error.message || 'Unable to sign in.', 'error');
            return;
        }

        if (data.user) {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        showAlert('Login failed. Please try again.', 'error');
        console.error(error);
    }
}

async function handleSignup(event) {
    event.preventDefault();
    clearAlert();

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const role = document.getElementById('role')?.value;
    const organization = document.getElementById('organization')?.value.trim();
    const college = document.getElementById('college')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    if (!name || name.length < 2) {
        showAlert('Enter your full name.', 'error');
        return;
    }

    if (!validateEmail(email)) {
        showAlert('Please enter a valid email address.', 'error');
        return;
    }

    if (!validatePhone(phone)) {
        showAlert('Phone number must be 10 digits.', 'error');
        return;
    }

    if (!role) {
        showAlert('Select your role.', 'error');
        return;
    }

    if (!organization) {
        showAlert('Enter your organization or college.', 'error');
        return;
    }

    if (!validatePassword(password)) {
        showAlert('Password must be at least 6 characters.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    phone,
                    role,
                    organization,
                    college,
                },
            },
        });

        if (error) {
            showAlert(error.message || 'Registration failed.', 'error');
            return;
        }

        if (data?.user?.id) {
            await supabaseClient.from('profiles').upsert({
                id: data.user.id,
                name,
                email,
                phone,
                role,
                organization,
                college,
                created_at: new Date().toISOString(),
            });
        }

        showAlert('Signup successful. Redirecting to dashboard...', 'success', 5000);
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);
    } catch (error) {
        console.error(error);
        showAlert('Signup failed. Please try again.', 'error');
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout failed:', error);
        showAlert('Logout failed. Please refresh and try again.', 'error');
    }
}

async function checkAuthStatus() {
    if (!supabaseClient) return null;
    try {
        const { data } = await supabaseClient.auth.getUser();
        return data?.user || null;
    } catch (error) {
        console.error('Auth status check failed:', error);
        return null;
    }
}

async function fetchProfile(userId) {
    if (!userId) return null;
    try {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) {
            console.warn('Profile fetch error:', error.message || error);
        }

        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !userData?.user) {
            console.warn('Unable to load auth user for profile fallback.', userError);
            return data || null;
        }

        const user = userData.user;
        const meta = user.user_metadata || {};
        const fallback = {
            id: user.id,
            name: meta.name || meta.full_name || meta.fullName || data?.name || '',
            email: user.email,
            phone: meta.phone || data?.phone || '',
            role: meta.role || data?.role || '',
            organization: meta.organization || meta.company || data?.organization || '',
            college: meta.college || data?.college || '',
            created_at: data?.created_at || new Date().toISOString(),
        };

        if (data) {
            const shouldUpdate = !data.name || !data.role || !data.organization || !data.college || !data.phone;
            if (shouldUpdate) {
                const { error: updateError } = await supabaseClient.from('profiles').upsert(fallback);
                if (updateError) {
                    console.warn('Profile fallback update failed:', updateError);
                }
            }
            return fallback;
        }

        const { error: upsertError } = await supabaseClient.from('profiles').upsert(fallback);
        if (upsertError) {
            console.warn('Profile fallback upsert failed:', upsertError);
            return fallback;
        }

        return fallback;
    } catch (error) {
        console.error('Profile fetch failed:', error);
        return null;
    }
}

function getPageName() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function setRoleBadge(role) {
    if (!role) return '';
    const label = role[0].toUpperCase() + role.slice(1);
    return `<span class="eyebrow">Role: ${label}</span>`;
}

async function ensurePageAccess() {
    const page = getPageName();
    const publicPages = ['index.html', 'login.html', 'signup.html'];
    const user = await checkAuthStatus();

    if (publicPages.includes(page) && user && page !== 'index.html') {
        window.location.href = 'dashboard.html';
        return null;
    }

    if (!publicPages.includes(page) && !user) {
        window.location.href = 'login.html';
        return null;
    }

    return user;
}

async function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    loginForm.addEventListener('submit', handleLogin);
}

async function initializeSignupPage() {
    const signupForm = document.getElementById('signupForm');
    if (!signupForm) return;
    signupForm.addEventListener('submit', handleSignup);
}

async function initializeDashboardPage(user) {
    const profile = await fetchProfile(user.id);
    const meta = user.user_metadata || {};
    const displayProfile = {
        name: profile?.name || meta.name || meta.full_name || user.email,
        role: profile?.role || meta.role || 'N/A',
        organization: profile?.organization || meta.organization || meta.company || 'N/A',
        college: profile?.college || meta.college || 'N/A',
    };
    const summary = document.getElementById('dashboardStats');
    const activity = document.getElementById('dashboardActivity');
    const rolePanel = document.getElementById('dashboardRole');

    const [{ data: projects }, { data: applications }, { data: tests }, { data: courses }] = await Promise.all([
        supabaseClient.from('projects').select('*'),
        supabaseClient.from('applications').select('*'),
        supabaseClient.from('results').select('*'),
        supabaseClient.from('courses').select('*'),
    ]);

    summary.innerHTML = `
        <div class="stat-card card">
            <h3>Live projects</h3>
            <p>${projects?.length || 0}</p>
        </div>
        <div class="stat-card card">
            <h3>Applications</h3>
            <p>${applications?.length || 0}</p>
        </div>
        <div class="stat-card card">
            <h3>Tests completed</h3>
            <p>${tests?.length || 0}</p>
        </div>
        <div class="stat-card card">
            <h3>Available courses</h3>
            <p>${courses?.length || 0}</p>
        </div>
    `;

    if (rolePanel) {
        rolePanel.innerHTML = `
            <div class="panel-item">
                <h3>${displayProfile.name}</h3>
                <p>${displayProfile.organization !== 'N/A' ? displayProfile.organization : ''}</p>
                <p>${displayProfile.college !== 'N/A' ? `College: ${displayProfile.college}` : ''}</p>
                <p>${setRoleBadge(displayProfile.role)}</p>
            </div>
        `;
    }

    if (activity) {
        const recent = [];
        if (profile?.role === 'student') {
            recent.push('Browse live projects and submit applications.');
            recent.push('Track your course progress and test scores.');
        } else if (profile?.role === 'company') {
            recent.push('Publish new projects and review applicants.');
            recent.push('Schedule interviews and feedback sessions.');
        } else {
            recent.push('Monitor student accomplishments and create events.');
            recent.push('Review mentorship requests and forum discussions.');
        }

        activity.innerHTML = recent.map(item => `<div class="panel-item"><p>${item}</p></div>`).join('');
    }
}

function renderCards(container, items) {
    if (!container) return;
    container.innerHTML = items.map(item => item.outerHTML || item).join('');
}

function buildProjectCard(project, user, profile) {
    const deadlineText = project.deadline ? `Deadline: ${new Date(project.deadline).toLocaleDateString()}` : 'No deadline set';
    const companyName = project.profiles?.organization || project.profiles?.name || 'Company';
    const isStudent = profile?.role === 'student';
    const isCompany = profile?.role === 'company';

    // Check if project is active (not past deadline)
    const isActive = !project.deadline || new Date(project.deadline) > new Date();
    const statusBadge = !isActive ? '<span class="status-badge expired">Expired</span>' : '';

    const actionButton = isStudent && isActive
        ? `<button type="button" class="btn btn-secondary apply-btn" data-project-id="${project.id}">Apply</button>`
        : isCompany
            ? `<a href="applications.html" class="btn btn-secondary">View Applications</a>`
            : '';

    return `
        <article class="project-card ${!isActive ? 'expired' : ''}">
            <div class="project-header">
                <h3>${project.title}</h3>
                ${statusBadge}
            </div>
            <p>${project.description || 'Description not available.'}</p>
            <small>${deadlineText}</small>
            <small>Posted by ${companyName}</small>
            ${actionButton}
        </article>
    `;
}

async function initializeProjectsPage(user) {
    const profile = await fetchProfile(user.id);
    const projectList = document.getElementById('projectsList');
    const projectFormPanel = document.getElementById('projectFormPanel');

    if (profile?.role === 'company' && projectFormPanel) {
        projectFormPanel.classList.remove('hidden');
        const form = document.getElementById('projectForm');
        form?.addEventListener('submit', async event => {
            event.preventDefault();
            clearAlert();
            const title = document.getElementById('projectTitle')?.value.trim();
            const description = document.getElementById('projectDescription')?.value.trim();
            const deadline = document.getElementById('projectDeadline')?.value;
            if (!title || !description || !deadline) {
                showAlert('Complete all project fields.', 'error');
                return;
            }
            const { error } = await supabaseClient.from('projects').insert([{ title, description, deadline, company_id: user.id }]);
            if (error) {
                showAlert('Unable to publish project.', 'error');
                return;
            }
            showAlert('Project published successfully.', 'success');
            form.reset();
            await initializeProjectsPage(user);
        });
    }

async function initializeProjectsPage(user) {
    const profile = await fetchProfile(user.id);
    const projectList = document.getElementById('projectsList');
    const projectFormPanel = document.getElementById('projectFormPanel');

    if (profile?.role === 'company' && projectFormPanel) {
        projectFormPanel.classList.remove('hidden');
        const form = document.getElementById('projectForm');
        form?.addEventListener('submit', async event => {
            event.preventDefault();
            clearAlert();
            const title = document.getElementById('projectTitle')?.value.trim();
            const description = document.getElementById('projectDescription')?.value.trim();
            const deadline = document.getElementById('projectDeadline')?.value;
            if (!title || !description || !deadline) {
                showAlert('Complete all project fields.', 'error');
                return;
            }
            const { error } = await supabaseClient.from('projects').insert([{ title, description, deadline, company_id: user.id }]);
            if (error) {
                showAlert('Unable to publish project.', 'error');
                return;
            }
            showAlert('Project published successfully.', 'success');
            form.reset();
            await initializeProjectsPage(user);
        });
    }

    // Load and display projects
    await loadAndDisplayProjects(user, profile);

    // Set up search and filter functionality
    setupSearchAndFilters(user, profile);
}

async function loadAndDisplayProjects(user, profile, searchTerm = '', statusFilter = 'all', sortBy = 'newest') {
    const projectList = document.getElementById('projectsList');

    let query = supabaseClient.from('projects').select('*, profiles(name, organization)');

    // Apply sorting
    switch (sortBy) {
        case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
        case 'deadline':
            query = query.order('deadline', { ascending: true, nullsLast: true });
            break;
        default: // newest
            query = query.order('created_at', { ascending: false });
    }

    const { data: projects, error } = await query;
    if (error) {
        console.error('Projects fetch failed:', error);
        projectList.innerHTML = '<p class="placeholder-text">Unable to load projects.</p>';
        return;
    }

    if (!projects || projects.length === 0) {
        projectList.innerHTML = '<p class="placeholder-text">No active projects found.</p>';
        return;
    }

    // Apply filters and search
    let filteredProjects = projects;

    // Status filter
    if (statusFilter === 'active') {
        const now = new Date();
        filteredProjects = filteredProjects.filter(project => !project.deadline || new Date(project.deadline) > now);
    } else if (statusFilter === 'deadline') {
        filteredProjects = filteredProjects.filter(project => project.deadline);
    }

    // Search filter
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredProjects = filteredProjects.filter(project =>
            project.title.toLowerCase().includes(term) ||
            project.description.toLowerCase().includes(term) ||
            (project.profiles?.name && project.profiles.name.toLowerCase().includes(term)) ||
            (project.profiles?.organization && project.profiles.organization.toLowerCase().includes(term))
        );
    }

    if (filteredProjects.length === 0) {
        projectList.innerHTML = '<p class="placeholder-text">No projects match your search criteria.</p>';
        return;
    }

    projectList.innerHTML = filteredProjects.map(project => buildProjectCard(project, user, profile)).join('');
}

function setupSearchAndFilters(user, profile) {
    const searchInput = document.getElementById('projectSearch');
    const searchBtn = document.getElementById('searchBtn');
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (!searchInput || !searchBtn || !statusFilter || !sortFilter) return;

    // Search functionality
    const performSearch = () => {
        const searchTerm = searchInput.value.trim();
        const statusValue = statusFilter.value;
        const sortValue = sortFilter.value;
        loadAndDisplayProjects(user, profile, searchTerm, statusValue, sortValue);
    };

    // Search on button click
    searchBtn.addEventListener('click', performSearch);

    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Filter on change
    statusFilter.addEventListener('change', performSearch);
    sortFilter.addEventListener('change', performSearch);

    // Real-time search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 300);
    });
}
}

async function applyToProject(projectId, user) {
    const modal = document.getElementById('applyModal');
    const form = document.getElementById('applyForm');
    const linkInput = document.getElementById('submissionLink');
    const descInput = document.getElementById('submissionDescription');
    const fileInput = document.getElementById('projectFile');

    // Reset form
    form.reset();
    modal.classList.remove('hidden');

    // Handle modal close
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.onclick = () => modal.classList.add('hidden');
    window.onclick = (event) => {
        if (event.target === modal) modal.classList.add('hidden');
    };

    // Handle form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        clearAlert();

        const submissionLink = linkInput.value.trim();
        const description = descInput.value.trim();
        const file = fileInput.files[0];

        if (!submissionLink || !description) {
            showAlert('Please fill in all required fields.', 'error');
            return;
        }

        let fileUrl = null;
        if (file) {
            // Upload file to Supabase storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${projectId}_${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('projects')
                .upload(fileName, file);

            if (uploadError) {
                showAlert('File upload failed. Please try again.', 'error');
                return;
            }

            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from('projects')
                .getPublicUrl(fileName);
            
            fileUrl = urlData.publicUrl;
        }

        const { error } = await supabaseClient.from('applications').insert([{
            project_id: projectId,
            student_id: user.id,
            status: 'Pending',
            submission_link: submissionLink,
            submission_description: description,
            submission_file_url: fileUrl
        }]);

        if (error) {
            console.error('Application error:', error);
            showAlert('Unable to apply. Try again later.', 'error');
            return;
        }

        showAlert('Application submitted successfully.', 'success');
        modal.classList.add('hidden');
    };
}

async function initializeApplicationsPage(user) {
    const profile = await fetchProfile(user.id);
    const list = document.getElementById('applicationsList');

    if (!list) return;

    let applications = [];
    try {
        if (profile?.role === 'student') {
            const { data, error } = await supabaseClient.from('applications').select('*').eq('student_id', user.id);
            if (error) throw error;
            applications = data;
        } else if (profile?.role === 'company') {
            const { data: myProjects, error: projectError } = await supabaseClient.from('projects').select('id,title').eq('company_id', user.id);
            if (projectError) throw projectError;
            const projectIds = myProjects.map(project => project.id);
            if (projectIds.length) {
                const { data, error } = await supabaseClient.from('applications').select('*').in('project_id', projectIds);
                if (error) throw error;
                applications = data;
            }
        } else {
            const { data, error } = await supabaseClient.from('applications').select('*');
            if (error) throw error;
            applications = data;
        }
    } catch (error) {
        console.error('Applications fetch failed:', error);
        list.innerHTML = '<p class="placeholder-text">Unable to load applications.</p>';
        return;
    }

    if (!applications.length) {
        list.innerHTML = '<p class="placeholder-text">No applications found yet.</p>';
        return;
    }

    list.innerHTML = applications.map(app => `
        <article class="project-card">
            <h3>Application ${app.id}</h3>
            <p>Status: ${app.status || 'Pending'}</p>
            <small>Project ID: ${app.project_id}</small>
            <small>Submitted link: <a href="${app.submission_link}" target="_blank">${app.submission_link || 'N/A'}</a></small>
            ${app.submission_description ? `<small>Description: ${app.submission_description}</small>` : ''}
            ${app.submission_file_url ? `<small>File: <a href="${app.submission_file_url}" target="_blank">Download</a></small>` : ''}
            <small>Feedback: ${app.feedback || 'No feedback yet'}</small>
            ${profile?.role === 'company' ? `<button type="button" class="btn btn-secondary review-btn" data-app-id="${app.id}">Review Application</button>` : ''}
        </article>
    `).join('');

    // Add event listeners for review buttons
    if (profile?.role === 'company') {
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appId = e.target.dataset.appId;
                openReviewModal(appId, applications);
            });
        });
    }
}

function openReviewModal(appId, applications) {
    const app = applications.find(a => a.id == appId);
    if (!app) return;

    const modal = document.getElementById('reviewModal');
    const statusSelect = document.getElementById('reviewStatus');
    const feedbackTextarea = document.getElementById('reviewFeedback');
    const form = document.getElementById('reviewForm');

    // Pre-fill current values
    statusSelect.value = app.status || 'Pending';
    feedbackTextarea.value = app.feedback || '';

    modal.classList.remove('hidden');

    // Handle modal close
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.onclick = () => modal.classList.add('hidden');
    window.onclick = (event) => {
        if (event.target === modal) modal.classList.add('hidden');
    };

    // Handle form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        const status = statusSelect.value;
        const feedback = feedbackTextarea.value.trim();

        const { error } = await supabaseClient
            .from('applications')
            .update({ status, feedback })
            .eq('id', appId);

        if (error) {
            showAlert('Failed to update application.', 'error');
            return;
        }

        showAlert('Application reviewed successfully.', 'success');
        modal.classList.add('hidden');
        // Refresh the page to show updated data
        location.reload();
    };
}

async function initializeCoursesPage(user) {
    const profile = await fetchProfile(user.id);
    const list = document.getElementById('coursesList');
    const createPanel = document.getElementById('courseCreatePanel');
    const detailPanel = document.getElementById('courseDetailPanel');

    if (profile?.role === 'company' || profile?.role === 'faculty') {
        createPanel.classList.remove('hidden');
        createPanel.innerHTML = `
            <div class="card">
                <h2>Upload a course</h2>
                <p>Publish course material, lessons, and certification ready content for students.</p>
                <form id="courseCreateForm" class="action-panel">
                    <label for="courseTitle">Course title</label>
                    <input type="text" id="courseTitle" placeholder="Course title" required>
                    <label for="courseDescription">Description</label>
                    <textarea id="courseDescription" placeholder="Course summary and learning outcomes" required></textarea>
                    <label for="courseLink">Material link</label>
                    <input type="url" id="courseLink" placeholder="Optional external learning link">
                    <label for="courseFile">Upload resource file</label>
                    <input type="file" id="courseFile" accept=".pdf,.zip,.doc,.docx,.ppt,.pptx">
                    <button type="submit" class="btn btn-primary">Publish course</button>
                </form>
                <button type="button" id="createSampleCourseBtn" class="btn btn-secondary">Create sample course</button>
            </div>
        `;
        setupCourseCreation(user);
    } else {
        createPanel.classList.add('hidden');
    }

    detailPanel.classList.add('hidden');
    detailPanel.innerHTML = '';

    const { data: courses, error } = await supabaseClient.from('courses').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Courses fetch failed:', error);
        list.innerHTML = '<p class="placeholder-text">Unable to load courses.</p>';
        return;
    }

    if (!courses.length) {
        list.innerHTML = '<p class="placeholder-text">No courses available yet.</p>';
        return;
    }

    const enrollmentData = await supabaseClient.from('enrollments').select('*').eq('student_id', user.id);
    const enrolledByCourse = (enrollmentData.data || []).reduce((map, item) => {
        map[item.course_id] = item;
        return map;
    }, {});

    list.innerHTML = courses.map(course => {
        const enrollment = enrolledByCourse[course.id];
        const isEnrolled = Boolean(enrollment);
        const progress = enrollment?.progress || 0;
        return `
            <article class="course-card">
                <h3>${course.title}</h3>
                <p>${course.content?.slice(0, 110) || course.description || 'Course outline not available.'}</p>
                ${isEnrolled ? `<p class="small-text">Progress: ${progress}%</p>` : ''}
                ${course.materials_url ? `<p class="small-text">Material: <a href="${course.materials_url}" target="_blank">Download</a></p>` : ''}
                ${isEnrolled
                    ? `<button type="button" class="btn btn-secondary view-course-btn" data-course-id="${course.id}">View course</button>`
                    : `<button type="button" class="btn btn-secondary course-enroll-btn" data-course-id="${course.id}">Enroll</button>`}
            </article>
        `;
    }).join('');
}

async function setupCourseCreation(user) {
    const form = document.getElementById('courseCreateForm');
    const sampleBtn = document.getElementById('createSampleCourseBtn');

    if (sampleBtn) {
        sampleBtn.addEventListener('click', async () => {
            await createSampleCourse(user);
        });
    }

    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        clearAlert();

        const title = document.getElementById('courseTitle')?.value.trim();
        const description = document.getElementById('courseDescription')?.value.trim();
        const link = document.getElementById('courseLink')?.value.trim();
        const file = document.getElementById('courseFile')?.files[0];

        if (!title || !description) {
            showAlert('Please provide both title and description.', 'error');
            return;
        }

        let materials_url = link || null;
        if (file) {
            const ext = file.name.split('.').pop();
            const fileName = `course_${Date.now()}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('course-materials').upload(fileName, file);
            if (uploadError) {
                console.warn('Course file upload failed:', uploadError.message || uploadError);
            } else {
                const { data: urlData } = supabaseClient.storage.from('course-materials').getPublicUrl(fileName);
                materials_url = urlData.publicUrl;
            }
        }

        const { error } = await supabaseClient.from('courses').insert([{ title, description, materials_url }]);
        if (error) {
            console.error('Course creation failed:', error);
            showAlert('Unable to publish course.', 'error');
            return;
        }

        showAlert('Course published successfully.', 'success');
        form.reset();
        await initializeCoursesPage(user);
    });
}

async function createSampleCourse(user) {
    clearAlert();
    const sampleCourse = {
        title: 'Career-ready Learning Path',
        description: 'A short course on resume building, interview preparation, and technical skill growth.',
        materials_url: 'https://example.com/learning-path'
    };

    const { error } = await supabaseClient.from('courses').insert([sampleCourse]);
    if (error) {
        console.error('Sample course creation failed:', error);
        showAlert('Unable to create sample course.', 'error');
        return;
    }

    showAlert('Sample course created successfully.', 'success');
    await initializeCoursesPage(user);
}

async function enrollCourse(courseId, user) {
    const { error } = await supabaseClient.from('enrollments').insert([{ course_id: courseId, student_id: user.id, progress: 0 }]);
    if (error) {
        console.error('Enrollment failed:', error);
        showAlert('Unable to enroll right now.', 'error');
        return;
    }
    showAlert('Enrollment successful!', 'success');
    await initializeCoursesPage(user);
}

async function viewCourseDetail(courseId, user) {
    const profile = await fetchProfile(user.id);
    const detailPanel = document.getElementById('courseDetailPanel');
    const { data: course, error: courseError } = await supabaseClient.from('courses').select('*').eq('id', courseId).single();
    if (courseError || !course) {
        console.error('Course fetch failed:', courseError);
        showAlert('Unable to load course details.', 'error');
        return;
    }

    const { data: enrollmentData } = await supabaseClient.from('enrollments').select('*').eq('course_id', courseId).eq('student_id', user.id).single();
    const enrollment = enrollmentData || { progress: 0 };
    const progress = enrollment.progress || 0;
    const completed = progress >= 100;

    detailPanel.classList.remove('hidden');
    detailPanel.innerHTML = `
        <div class="card">
            <div class="section-heading">
                <h2>${course.title}</h2>
                <p>${course.description || 'Course content not available.'}</p>
            </div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-background"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                <p class="small-text">Progress: ${progress}%</p>
            </div>
            ${course.materials_url ? `<p>Materials: <a href="${course.materials_url}" target="_blank">Open resource</a></p>` : ''}
            <div class="button-row">
                ${completed ? `<button type="button" class="btn btn-secondary download-cert-btn" data-course-id="${course.id}">Download certificate</button>` : `<button type="button" class="btn btn-primary complete-course-btn" data-course-id="${course.id}">Complete lesson</button>`}
                <button type="button" class="btn btn-ghost" id="closeCourseDetail">Close</button>
            </div>
            ${completed ? `<p class="small-text">Certificate generated for completed course.</p>` : '<p class="small-text">Complete lessons to reach 100% and unlock certification.</p>'}
        </div>
    `;
}

async function updateCourseProgress(courseId, user) {
    const { data: enrollmentData, error: enrollmentError } = await supabaseClient.from('enrollments').select('*').eq('course_id', courseId).eq('student_id', user.id).single();
    if (enrollmentError || !enrollmentData) {
        console.error('Enrollment fetch failed:', enrollmentError);
        showAlert('Unable to update progress.', 'error');
        return;
    }

    const currentProgress = enrollmentData.progress || 0;
    const nextProgress = Math.min(100, currentProgress + 20);

    const { error: updateError } = await supabaseClient.from('enrollments').update({ progress: nextProgress }).eq('id', enrollmentData.id);
    if (updateError) {
        console.error('Progress update failed:', updateError);
        showAlert('Unable to update progress.', 'error');
        return;
    }

    if (nextProgress >= 100) {
        showAlert('Congratulations! Course completed. Certificate unlocked.', 'success');
    } else {
        showAlert(`Progress updated to ${nextProgress}%.`, 'success');
    }

    await initializeCoursesPage(user);
    await viewCourseDetail(courseId, user);
}

function downloadCourseCertificate(course, profile) {
    const certificateText = `Certificate of Completion\n\nThis certifies that ${profile.name || 'Student'} has successfully completed the course: ${course.title}.\n\nDate: ${new Date().toLocaleDateString()}`;
    const blob = new Blob([certificateText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${course.title.replace(/\s+/g, '_')}_certificate.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert('Certificate downloaded.', 'success');
}

async function createSampleTest(user) {
    clearAlert();
    const sampleTest = {
        title: 'JavaScript Fundamentals',
        description: 'A quick coding and aptitude assessment for JavaScript basics.'
    };

    const { data: testData, error: testError } = await supabaseClient.from('tests').insert([sampleTest]).select().single();
    if (testError || !testData) {
        console.error('Sample test insert failed:', testError);
        showAlert('Unable to create sample test.', 'error');
        return;
    }

    const questions = [
        {
            test_id: testData.id,
            question: 'Which keyword is used to declare a constant in JavaScript?',
            options: ['var', 'let', 'const', 'static'],
            correct_answer: 'const'
        },
        {
            test_id: testData.id,
            question: 'What is the output of 2 + 3 + "5" in JavaScript?',
            options: ['105', '55', '23', 'NaN'],
            correct_answer: '55'
        },
        {
            test_id: testData.id,
            question: 'Which array method returns a new array with filtered values?',
            options: ['map()', 'filter()', 'reduce()', 'forEach()'],
            correct_answer: 'filter()'
        }
    ];

    const { error: questionError } = await supabaseClient.from('questions').insert(questions);
    if (questionError) {
        console.error('Sample questions insert failed:', questionError);
        showAlert('Sample test created, but questions failed to save.', 'error');
        return;
    }

    showAlert('Sample test created successfully. Refreshing tests...', 'success');
    await initializeTestsPage(user);
}

async function initializeTestsPage(user) {
    const profile = await fetchProfile(user.id);
    const createPanel = document.getElementById('testCreatePanel');
    const overviewPanel = document.getElementById('testOverview');
    const companyPanel = document.getElementById('companyScorePanel');
    const runner = document.getElementById('testRunner');

    if (!overviewPanel || !createPanel || !companyPanel || !runner) return;

    if (profile?.role === 'company' || profile?.role === 'faculty') {
        createPanel.classList.remove('hidden');
        createPanel.innerHTML = `
            <div class="card">
                <h2>Create an assessment</h2>
                <p>Publish a new test for students to take and track learning outcomes.</p>
                <form id="testCreateForm" class="action-panel">
                    <label for="testTitle">Test title</label>
                    <input type="text" id="testTitle" placeholder="Assessment title" required>
                    <label for="testDescription">Description</label>
                    <textarea id="testDescription" placeholder="Brief description of the assessment" required></textarea>
                    <button type="submit" class="btn btn-primary">Publish test</button>
                </form>
                <button type="button" id="createSampleTestBtn" class="btn btn-secondary">Create sample test</button>
            </div>
        `;
        setupTestCreation(user);
    } else {
        createPanel.classList.add('hidden');
        createPanel.innerHTML = '';
    }

    runner.classList.add('hidden');
    companyPanel.classList.toggle('hidden', profile?.role !== 'company');

    await loadTestsOverview(user);
    if (profile?.role === 'company') {
        await populateTestFilterDropdown();
        await loadCompanyScoreBoard(user);
        setupCompanyScoreFilters(user);
    }
}

async function populateTestFilterDropdown() {
    const testFilter = document.getElementById('scoreTestFilter');
    if (!testFilter) return;

    const { data: tests, error } = await supabaseClient.from('tests').select('id, title').order('created_at', { ascending: false });
    if (error || !tests) {
        console.warn('Failed to load tests for filter:', error);
        return;
    }

    const options = tests.map(test => `<option value="${test.id}">${test.title}</option>`).join('');
    testFilter.innerHTML = `<option value="all">All Tests</option>${options}`;
}

async function setupTestCreation(user) {
    const form = document.getElementById('testCreateForm');
    const sampleBtn = document.getElementById('createSampleTestBtn');

    if (sampleBtn) {
        sampleBtn.addEventListener('click', async () => {
            await createSampleTest(user);
        });
    }

    if (!form) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        clearAlert();

        const title = document.getElementById('testTitle')?.value.trim();
        const description = document.getElementById('testDescription')?.value.trim();

        if (!title || !description) {
            showAlert('Please enter a title and description for the test.', 'error');
            return;
        }

        const { error } = await supabaseClient.from('tests').insert([{ title, description }]);
        if (error) {
            console.error('Test creation failed:', error);
            showAlert('Unable to publish the test.', 'error');
            return;
        }

        showAlert('Test published successfully.', 'success');
        form.reset();
        await initializeTestsPage(user);
    });
}

async function loadTestsOverview(user) {
    const overviewPanel = document.getElementById('testOverview');
    if (!overviewPanel) return;

    const { data: tests, error } = await supabaseClient.from('tests').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Tests fetch failed:', error);
        overviewPanel.innerHTML = '<p class="placeholder-text">Unable to load tests right now.</p>';
        return;
    }

    if (!tests || tests.length === 0) {
        overviewPanel.innerHTML = '<p class="placeholder-text">No tests are available yet.</p>';
        return;
    }

    overviewPanel.innerHTML = tests.map(test => `
        <article class="project-card">
            <h3>${test.title}</h3>
            <p>${test.description || 'No description available.'}</p>
            <button type="button" class="btn btn-primary start-test-btn" data-test-id="${test.id}">Start test</button>
        </article>
    `).join('');
}

async function loadCompanyScoreBoard(user, searchTerm = '', testId = 'all', minScore = 0) {
    const scoreboardList = document.getElementById('scoreboardList');
    if (!scoreboardList) return;

    let query = supabaseClient.from('results').select('*, profiles(name, college, organization), tests(title)').order('score', { ascending: false });
    if (testId && testId !== 'all') {
        query = query.eq('test_id', testId);
    }

    const { data: results, error } = await query;
    if (error) {
        console.error('Scoreboard load failed:', error);
        scoreboardList.innerHTML = '<p class="placeholder-text">Unable to load student scores.</p>';
        return;
    }

    let filtered = results || [];
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(item =>
            item.profiles?.name?.toLowerCase().includes(term) ||
            item.profiles?.college?.toLowerCase().includes(term) ||
            item.profiles?.organization?.toLowerCase().includes(term)
        );
    }

    filtered = filtered.filter(item => item.score >= Number(minScore));

    if (!filtered.length) {
        scoreboardList.innerHTML = '<p class="placeholder-text">No student results match the selected filters.</p>';
        return;
    }

    scoreboardList.innerHTML = filtered.map(result => `
        <article class="project-card">
            <h3>${result.profiles?.name || 'Student'}</h3>
            <p>${result.tests?.title || 'Assessment'}</p>
            <small>Score: ${result.score}%</small>
            <small>College: ${result.profiles?.college || 'N/A'}</small>
            <small>Organization: ${result.profiles?.organization || 'N/A'}</small>
        </article>
    `).join('');
}

function setupCompanyScoreFilters(user) {
    const studentSearch = document.getElementById('studentSearch');
    const searchBtn = document.getElementById('scoreSearchBtn');
    const testFilter = document.getElementById('scoreTestFilter');
    const minFilter = document.getElementById('scoreMinFilter');

    if (!studentSearch || !searchBtn || !testFilter || !minFilter) return;

    const runFilter = () => {
        loadCompanyScoreBoard(user, studentSearch.value.trim(), testFilter.value, minFilter.value);
    };

    searchBtn.addEventListener('click', runFilter);
    studentSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runFilter();
        }
    });
    testFilter.addEventListener('change', runFilter);
    minFilter.addEventListener('change', runFilter);
}

async function loadTest(testId, user) {
    const runner = document.getElementById('testRunner');
    const { data: test } = await supabaseClient.from('tests').select('*').eq('id', testId).single();
    const { data: questions } = await supabaseClient.from('questions').select('*').eq('test_id', testId);
    if (!test || !questions) {
        showAlert('Unable to load test questions.', 'error');
        return;
    }

    runner.classList.remove('hidden');
    runner.innerHTML = `
        <div class="card">
            <h2>${test.title}</h2>
            <form id="quizForm">
                ${questions.map((question, index) => `
                    <div class="form-group">
                        <label><strong>${index + 1}. ${question.question}</strong></label>
                        ${(question.options || []).map((option, optionIndex) => `
                            <label class="radio-label">
                                <input type="radio" name="q-${question.id}" value="${option}" required>
                                ${option}
                            </label>
                        `).join('')}
                    </div>
                `).join('')}
                <button type="submit" class="btn btn-primary">Submit answers</button>
            </form>
        </div>
    `;

    document.getElementById('quizForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const answers = {};
        questions.forEach(question => {
            answers[question.id] = document.querySelector(`input[name="q-${question.id}"]:checked`)?.value || '';
        });

        const score = questions.reduce((sum, question) => sum + (answers[question.id] === question.correct_answer ? 1 : 0), 0);
        const percentage = Math.round((score / questions.length) * 100);

        const { error: insertError } = await supabaseClient.from('results').insert([{ test_id: test.id, student_id: user.id, score: percentage }]);
        if (insertError) {
            console.error('Result insert failed:', insertError);
            showAlert('Unable to save your score. Please try again.', 'error');
            return;
        }

        try {
            await supabaseClient.from('profiles').update({ last_test_score: percentage }).eq('id', user.id);
        } catch (updateError) {
            // If profile update field does not exist, ignore it and keep the result row.
            console.warn('Profile score update skipped:', updateError.message || updateError);
        }

        showAlert(`You scored ${percentage}% on ${test.title}.`, 'success');
        runner.classList.add('hidden');
    });
}

async function initializeEventsPage(user) {
    const profile = await fetchProfile(user.id);
    const createPanel = document.getElementById('eventCreatePanel');
    const notificationPanel = document.getElementById('notificationPanel');
    const attendancePanel = document.getElementById('attendancePanel');
    const list = document.getElementById('eventsList');

    // Show event creation panel for company/faculty
    if (profile?.role === 'company' || profile?.role === 'faculty') {
        createPanel.classList.remove('hidden');
        createPanel.innerHTML = `
            <div class="card">
                <h2>Host a webinar or workshop</h2>
                <p>Create events, invite students, and track attendance for learning initiatives.</p>
                <form id="eventCreateForm" class="action-panel">
                    <label for="eventTitle">Event title</label>
                    <input type="text" id="eventTitle" placeholder="Webinar or workshop title" required>
                    <label for="eventDescription">Description</label>
                    <textarea id="eventDescription" placeholder="Event summary and learning objectives" required></textarea>
                    <label for="eventDate">Date & Time</label>
                    <input type="datetime-local" id="eventDate" required>
                    <label for="eventDuration">Duration (minutes)</label>
                    <input type="number" id="eventDuration" placeholder="e.g., 60" min="15" required>
                    <label for="eventLink">Meeting link</label>
                    <input type="url" id="eventLink" placeholder="Zoom, Teams, or other meeting platform link" required>
                    <label for="eventCapacity">Capacity (max participants)</label>
                    <input type="number" id="eventCapacity" placeholder="Leave empty for unlimited" min="1">
                    <button type="submit" class="btn btn-primary">Publish event</button>
                </form>
            </div>
        `;
        setupEventCreation(user);
        attendancePanel.classList.remove('hidden');
        await loadAttendanceTracker(user);
    } else {
        createPanel.classList.add('hidden');
        attendancePanel.classList.add('hidden');
    }

    // Load upcoming event notifications
    await loadUpcomingNotifications(user);

    // Load and display events
    await loadAndDisplayEvents(user, profile);
}

async function setupEventCreation(user) {
    const form = document.getElementById('eventCreateForm');
    if (!form) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        clearAlert();

        const title = document.getElementById('eventTitle')?.value.trim();
        const description = document.getElementById('eventDescription')?.value.trim();
        const date = document.getElementById('eventDate')?.value;
        const duration = document.getElementById('eventDuration')?.value;
        const link = document.getElementById('eventLink')?.value.trim();
        const capacity = document.getElementById('eventCapacity')?.value || null;

        if (!title || !description || !date || !duration || !link) {
            showAlert('Please complete all required fields.', 'error');
            return;
        }

        const { error } = await supabaseClient.from('events').insert([{
            title,
            description,
            date,
            duration: parseInt(duration),
            link,
            capacity: capacity ? parseInt(capacity) : null,
            organizer_id: user.id,
            organizer_type: 'company',
            created_at: new Date().toISOString(),
        }]);

        if (error) {
            console.error('Event creation failed:', error);
            showAlert('Unable to publish the event.', 'error');
            return;
        }

        showAlert('Webinar published successfully. Students can now register.', 'success');
        form.reset();
        await initializeEventsPage(user);
    });
}

async function loadAndDisplayEvents(user, profile) {
    const list = document.getElementById('eventsList');
    if (!list) return;

    const { data: events, error } = await supabaseClient.from('events').select('*').order('date', { ascending: true });
    if (error) {
        console.error('Events fetch failed:', error);
        list.innerHTML = '<p class="placeholder-text">Unable to load events.</p>';
        return;
    }

    if (!events || events.length === 0) {
        list.innerHTML = '<p class="placeholder-text">No upcoming events available yet.</p>';
        return;
    }

    // Get registrations for this user
    const { data: registrations, error: regError } = await supabaseClient
        .from('event_registrations')
        .select('event_id')
        .eq('user_id', user.id);
    
    const registeredIds = new Set((registrations || []).map(r => r.event_id));

    // Get attendance records for this user
    const { data: attendance, error: attError } = await supabaseClient
        .from('event_attendance')
        .select('event_id')
        .eq('user_id', user.id);
    
    const attendedIds = new Set((attendance || []).map(a => a.event_id));

    list.innerHTML = events.map(event => {
        const isRegistered = registeredIds.has(event.id);
        const isAttended = attendedIds.has(event.id);
        const eventDate = new Date(event.date);
        const now = new Date();
        const isUpcoming = eventDate > now;
        const statusBadge = isAttended ? '<span class="status-badge attended">Attended</span>' : 
                           isRegistered && !isUpcoming ? '<span class="status-badge pending">Event ended</span>' :
                           isRegistered ? '<span class="status-badge registered">Registered</span>' : '';

        const actionButton = !isAttended && isUpcoming
            ? (isRegistered
                ? `<button type="button" class="btn btn-secondary mark-attendance-btn" data-event-id="${event.id}">Mark attendance</button>`
                : `<button type="button" class="btn btn-primary register-event-btn" data-event-id="${event.id}">Register now</button>`)
            : '';

        return `
            <article class="event-card">
                <div class="event-header">
                    <h3>${event.title}</h3>
                    ${statusBadge}
                </div>
                <p>${event.description || 'No description available.'}</p>
                <small><strong>When:</strong> ${eventDate.toLocaleString()}</small>
                <small><strong>Duration:</strong> ${event.duration} minutes</small>
                ${event.capacity ? `<small><strong>Capacity:</strong> Limited to ${event.capacity} participants</small>` : ''}
                <small>
                    <strong>Join:</strong> 
                    ${event.link ? `<a href="${event.link}" target="_blank" rel="noreferrer">Open link</a>` : 'Link not available'}
                </small>
                ${actionButton}
            </article>
        `;
    }).join('');
}

async function loadUpcomingNotifications(user) {
    const notificationPanel = document.getElementById('notificationPanel');
    if (!notificationPanel) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .gt('date', now.toISOString())
        .lt('date', tomorrow.toISOString())
        .order('date', { ascending: true });

    if (error || !events || events.length === 0) {
        notificationPanel.innerHTML = '';
        return;
    }

    notificationPanel.innerHTML = `
        <div class="card notification-card">
            <span class="eyebrow">Upcoming in 24 hours</span>
            <h2>Don't miss these webinars!</h2>
            <ul class="notifications-list">
                ${events.map(event => `
                    <li>
                        <strong>${event.title}</strong>
                        <small>${new Date(event.date).toLocaleString()}</small>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

async function loadAttendanceTracker(user) {
    const attendancePanel = document.getElementById('attendancePanel');
    if (!attendancePanel) return;

    const { data: events, error: eventsError } = await supabaseClient
        .from('events')
        .select('*')
        .eq('organizer_id', user.id)
        .order('date', { ascending: false });

    if (eventsError || !events || events.length === 0) {
        attendancePanel.innerHTML = '<p class="placeholder-text">No events created yet.</p>';
        return;
    }

    let html = '<h2 style="margin-bottom:20px;">Attendance Tracking</h2>';

    for (const event of events) {
        const { data: registrations, error: regError } = await supabaseClient
            .from('event_registrations')
            .select('*')
            .eq('event_id', event.id);

        const { data: attendance, error: attError } = await supabaseClient
            .from('event_attendance')
            .select('*')
            .eq('event_id', event.id);

        const registeredCount = registrations?.length || 0;
        const attendedCount = attendance?.length || 0;
        const attendanceRate = registeredCount > 0 ? Math.round((attendedCount / registeredCount) * 100) : 0;

        html += `
            <div class="card" style="margin-bottom: 20px;">
                <h3>${event.title}</h3>
                <p><small>${new Date(event.date).toLocaleString()}</small></p>
                <div class="stats-row">
                    <div class="stat">
                        <span class="stat-label">Registered</span>
                        <span class="stat-value">${registeredCount}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Attended</span>
                        <span class="stat-value">${attendedCount}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Rate</span>
                        <span class="stat-value">${attendanceRate}%</span>
                    </div>
                </div>
                <button type="button" class="btn btn-secondary view-registrations-btn" data-event-id="${event.id}" style="margin-top: 10px;">View registrations</button>
            </div>
        `;
    }

    attendancePanel.innerHTML = html;
}


async function registerEvent(eventId, user) {
    const { data: event, error: eventError } = await supabaseClient
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (eventError || !event) {
        showAlert('Unable to load event details.', 'error');
        return;
    }

    // Check capacity
    if (event.capacity) {
        const { data: registrations, error: regError } = await supabaseClient
            .from('event_registrations')
            .select('id', { count: 'exact' })
            .eq('event_id', eventId);

        if (registrations && registrations.length >= event.capacity) {
            showAlert('This event is at full capacity.', 'error');
            return;
        }
    }

    const { error } = await supabaseClient.from('event_registrations').insert([{
        event_id: eventId,
        user_id: user.id,
        registered_at: new Date().toISOString(),
    }]);

    if (error) {
        if (error.code === '23505') { // Unique constraint violation
            showAlert('You are already registered for this event.', 'info');
        } else {
            console.error('Event registration failed:', error);
            showAlert('Unable to register for the event.', 'error');
        }
        return;
    }

    showAlert('Registration confirmed! Check your email for event details.', 'success');
    await initializeEventsPage(user);
}

async function markEventAttendance(eventId, user) {
    const { error } = await supabaseClient.from('event_attendance').insert([{
        event_id: eventId,
        user_id: user.id,
        attended_at: new Date().toISOString(),
    }]);

    if (error) {
        if (error.code === '23505') { // Already marked
            showAlert('Attendance already recorded for this event.', 'info');
        } else {
            console.error('Attendance marking failed:', error);
            showAlert('Unable to mark attendance.', 'error');
        }
        return;
    }

    showAlert('Attendance recorded! Thank you for attending.', 'success');
    await initializeEventsPage(user);
}

async function viewEventRegistrations(eventId) {
    const { data: registrations, error } = await supabaseClient
        .from('event_registrations')
        .select('*, profiles(name, email, organization)')
        .eq('event_id', eventId)
        .order('registered_at', { ascending: false });

    if (error || !registrations) {
        showAlert('Unable to load registrations.', 'error');
        return;
    }

    const modal = document.getElementById('registrationsModal') || createRegistrationsModal();
    const list = modal.querySelector('.registrations-list');

    if (!registrations.length) {
        list.innerHTML = '<p class="placeholder-text">No registrations yet.</p>';
    } else {
        list.innerHTML = registrations.map(reg => `
            <article class="registration-item">
                <h4>${reg.profiles?.name || 'Anonymous'}</h4>
                <small>Email: ${reg.profiles?.email || 'N/A'}</small>
                <small>Organization: ${reg.profiles?.organization || 'N/A'}</small>
                <small>Registered: ${new Date(reg.registered_at).toLocaleString()}</small>
            </article>
        `).join('');
    }

    modal.classList.remove('hidden');
}

function createRegistrationsModal() {
    const modal = document.createElement('div');
    modal.id = 'registrationsModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Event Registrations</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="registrations-list"></div>
        </div>
    `;
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    document.body.appendChild(modal);
    return modal;
}


async function initializeMentorshipPage(user) {
    const profile = await fetchProfile(user.id);
    const mentorProfilePanel = document.getElementById('mentorProfilePanel');
    const browseMentorsPanel = document.getElementById('browseMentorsPanel');
    const mentorRequestsPanel = document.getElementById('mentorRequestsPanel');
    const activeMentorshipsPanel = document.getElementById('activeMentorshipsPanel');
    const messagingPanel = document.getElementById('messagingPanel');

    // Hide all panels initially
    mentorProfilePanel.classList.add('hidden');
    browseMentorsPanel.classList.add('hidden');
    mentorRequestsPanel.classList.add('hidden');
    activeMentorshipsPanel.classList.add('hidden');
    messagingPanel.classList.add('hidden');

    if (profile?.role === 'company' || profile?.role === 'faculty') {
        // Mentor view
        mentorProfilePanel.classList.remove('hidden');
        await setupMentorProfile(user, profile);
        
        mentorRequestsPanel.classList.remove('hidden');
        await loadMentorshipRequests(user);
        
        activeMentorshipsPanel.classList.remove('hidden');
        await loadMentorActiveMentorships(user);
    } else {
        // Student view
        browseMentorsPanel.classList.remove('hidden');
        await loadMentorsDirectory(user);
        
        activeMentorshipsPanel.classList.remove('hidden');
        await loadStudentActiveMentorships(user);
    }

    messagingPanel.classList.add('hidden');
}

async function setupMentorProfile(user, profile) {
    const panel = document.getElementById('mentorProfilePanel');
    
    // Check if mentor profile exists
    const { data: mentorProfile } = await supabaseClient
        .from('mentor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (!mentorProfile) {
        // Create mentorship profile form
        panel.innerHTML = `
            <div class="card">
                <h2>Set up your mentor profile</h2>
                <p>Create a professional mentor profile to help students find and connect with you.</p>
                <form id="mentorProfileForm" class="action-panel">
                    <label for="mentorBio">Professional Bio</label>
                    <textarea id="mentorBio" placeholder="Share your background, experience, and mentoring approach..." required></textarea>
                    <label for="mentorExpertise">Areas of expertise</label>
                    <input type="text" id="mentorExpertise" placeholder="e.g., Full-stack development, Career coaching, Leadership" required>
                    <label for="mentorRate">Availability (hours per month)</label>
                    <input type="number" id="mentorRate" placeholder="e.g., 4" min="1" required>
                    <label for="mentorGoals">Mentoring goals for mentees</label>
                    <textarea id="mentorGoals" placeholder="What do you aim to help mentees achieve?" required></textarea>
                    <button type="submit" class="btn btn-primary">Create mentor profile</button>
                </form>
            </div>
        `;
        
        const form = panel.querySelector('#mentorProfileForm');
        form?.addEventListener('submit', async event => {
            event.preventDefault();
            clearAlert();

            const bio = document.getElementById('mentorBio')?.value.trim();
            const expertise = document.getElementById('mentorExpertise')?.value.trim();
            const rate = document.getElementById('mentorRate')?.value;
            const goals = document.getElementById('mentorGoals')?.value.trim();

            if (!bio || !expertise || !rate || !goals) {
                showAlert('Please complete all fields.', 'error');
                return;
            }

            const { error } = await supabaseClient.from('mentor_profiles').insert([{
                user_id: user.id,
                name: profile.name,
                organization: profile.organization,
                bio,
                expertise,
                availability_hours: parseInt(rate),
                goals,
                created_at: new Date().toISOString(),
            }]);

            if (error) {
                console.error('Mentor profile creation failed:', error);
                showAlert('Unable to create mentor profile.', 'error');
                return;
            }

            showAlert('Mentor profile created! Students can now find and request mentorship from you.', 'success');
            await initializeMentorshipPage(user);
        });
    } else {
        // Show existing profile with edit option
        panel.innerHTML = `
            <div class="card mentor-profile-card">
                <div class="profile-header">
                    <h2>${mentorProfile.name}</h2>
                    <span class="eyebrow">${mentorProfile.organization}</span>
                </div>
                <p><strong>Bio:</strong> ${mentorProfile.bio}</p>
                <p><strong>Expertise:</strong> ${mentorProfile.expertise}</p>
                <p><strong>Availability:</strong> ${mentorProfile.availability_hours} hours/month</p>
                <p><strong>Goals:</strong> ${mentorProfile.goals}</p>
                <button type="button" id="editMentorProfileBtn" class="btn btn-secondary">Edit profile</button>
            </div>
        `;

        const editBtn = panel.querySelector('#editMentorProfileBtn');
        editBtn?.addEventListener('click', () => {
            panel.classList.add('hidden');
            panel.classList.remove('hidden');
            setupMentorProfile(user, profile); // Reload to show form
        });
    }
}

async function loadMentorsDirectory(user) {
    const panel = document.getElementById('browseMentorsPanel');
    const list = panel.querySelector('#mentorsList');

    const { data: mentors, error } = await supabaseClient
        .from('mentor_profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !mentors || mentors.length === 0) {
        list.innerHTML = '<p class="placeholder-text">No mentors available yet.</p>';
        return;
    }

    // Get user's existing mentor requests
    const { data: userRequests } = await supabaseClient
        .from('mentorship_requests')
        .select('mentor_user_id, status')
        .eq('student_user_id', user.id);

    const requestMap = new Map((userRequests || []).map(r => [r.mentor_user_id, r.status]));

    list.innerHTML = mentors.map(mentor => {
        const status = requestMap.get(mentor.user_id);
        const btnText = status === 'pending' ? 'Request pending' : status === 'accepted' ? 'Message mentor' : 'Request mentorship';
        const btnClass = status === 'accepted' ? 'open-mentorship-btn' : 'request-mentor-btn';
        const isDisabled = status === 'pending' ? ' disabled' : '';

        return `
            <div class="mentor-card">
                <h3>${mentor.name}</h3>
                <p class="org-badge">${mentor.organization}</p>
                <p><strong>Bio:</strong> ${mentor.bio}</p>
                <p><strong>Expertise:</strong> ${mentor.expertise}</p>
                <p><strong>Availability:</strong> ${mentor.availability_hours} hours/month</p>
                <p><strong>Goals:</strong> ${mentor.goals}</p>
                <button type="button" class="${btnClass}" data-mentor-id="${mentor.user_id}" data-mentor-name="${mentor.name}"${isDisabled}>${btnText}</button>
            </div>
        `;
    }).join('');
}

async function loadMentorshipRequests(user) {
    const panel = document.getElementById('mentorRequestsPanel');
    const list = panel.querySelector('#requestsList');

    const { data: requests, error } = await supabaseClient
        .from('mentorship_requests')
        .select('*, profiles(name, email, organization)')
        .eq('mentor_user_id', user.id)
        .eq('status', 'pending');

    if (error || !requests || requests.length === 0) {
        list.innerHTML = '<p class="placeholder-text">No pending requests. Check back soon!</p>';
        return;
    }

    list.innerHTML = requests.map(request => `
        <article class="request-card">
            <div class="request-header">
                <h4>${request.profiles?.name}</h4>
                <span class="status-badge pending">Pending</span>
            </div>
            <small>Email: ${request.profiles?.email}</small>
            <small>Organization: ${request.profiles?.organization || 'N/A'}</small>
            <p><strong>Requested expertise:</strong> ${request.expertise_area}</p>
            <p><strong>Message:</strong> ${request.message}</p>
            <div class="button-row">
                <button type="button" class="btn btn-primary accept-request-btn" data-request-id="${request.id}">Accept</button>
                <button type="button" class="btn btn-ghost reject-request-btn" data-request-id="${request.id}">Decline</button>
            </div>
        </article>
    `).join('');
}

async function loadMentorActiveMentorships(user) {
    const panel = document.getElementById('activeMentorshipsPanel');
    const list = panel.querySelector('#mentorshipsList');

    const { data: mentorships, error } = await supabaseClient
        .from('mentorship_requests')
        .select('*, profiles(name, email, organization)')
        .eq('mentor_user_id', user.id)
        .eq('status', 'accepted');

    if (error || !mentorships || mentorships.length === 0) {
        list.innerHTML = '<p class="placeholder-text">No active mentorships yet.</p>';
        return;
    }

    list.innerHTML = mentorships.map(m => `
        <article class="mentorship-item">
            <h4>${m.profiles?.name}</h4>
            <small>Expertise: ${m.expertise_area}</small>
            <small>Started: ${new Date(m.created_at).toLocaleDateString()}</small>
            <button type="button" class="btn btn-secondary open-messaging-btn" data-mentorship-id="${m.id}" data-mentee-name="${m.profiles?.name}" data-mentee-id="${m.student_user_id}">Open chat</button>
        </article>
    `).join('');
}

async function loadStudentActiveMentorships(user) {
    const panel = document.getElementById('activeMentorshipsPanel');
    const list = panel.querySelector('#mentorshipsList');

    const { data: mentorships, error } = await supabaseClient
        .from('mentorship_requests')
        .select('*, mentor_profiles(name, organization)')
        .eq('student_user_id', user.id);

    if (error || !mentorships || mentorships.length === 0) {
        list.innerHTML = '<p class="placeholder-text">No active mentorships. Start by browsing mentors!</p>';
        return;
    }

    const grouped = {
        pending: mentorships.filter(m => m.status === 'pending'),
        accepted: mentorships.filter(m => m.status === 'accepted'),
        rejected: mentorships.filter(m => m.status === 'rejected'),
    };

    let html = '';

    if (grouped.pending.length > 0) {
        html += '<h3 style="margin-top: 20px;">Pending requests</h3>';
        html += grouped.pending.map(m => `
            <article class="mentorship-item pending">
                <h4>${m.mentor_profiles?.name}</h4>
                <small>Organization: ${m.mentor_profiles?.organization}</small>
                <small>Requested: ${new Date(m.created_at).toLocaleDateString()}</small>
                <span class="status-badge pending">Awaiting acceptance</span>
            </article>
        `).join('');
    }

    if (grouped.accepted.length > 0) {
        html += '<h3 style="margin-top: 20px;">Active mentorships</h3>';
        html += grouped.accepted.map(m => `
            <article class="mentorship-item">
                <h4>${m.mentor_profiles?.name}</h4>
                <small>Organization: ${m.mentor_profiles?.organization}</small>
                <small>Connected: ${new Date(m.created_at).toLocaleDateString()}</small>
                <button type="button" class="btn btn-secondary open-messaging-btn" data-mentorship-id="${m.id}" data-mentor-name="${m.mentor_profiles?.name}" data-mentor-id="${m.mentor_user_id}">Open chat</button>
            </article>
        `).join('');
    }

    if (grouped.rejected.length > 0) {
        html += '<h3 style="margin-top: 20px;">Not accepted</h3>';
        html += grouped.rejected.map(m => `
            <article class="mentorship-item rejected">
                <h4>${m.mentor_profiles?.name}</h4>
                <small>Status: Not available at this time</small>
            </article>
        `).join('');
    }

    list.innerHTML = html || '<p class="placeholder-text">No mentorship history.</p>';
}

async function requestMentorship(mentorId, mentorName, user) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Request mentorship from ${mentorName}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <form id="mentorRequestForm" class="action-panel">
                <label for="expertise">What expertise do you need?</label>
                <select id="expertise" required>
                    <option value="">Select area</option>
                    <option value="technical">Technical Skills</option>
                    <option value="career">Career Development</option>
                    <option value="leadership">Leadership</option>
                    <option value="product">Product Management</option>
                    <option value="design">Design & UX</option>
                    <option value="business">Business Strategy</option>
                </select>
                <label for="message">What would you like to discuss?</label>
                <textarea id="message" placeholder="Share your goals and what you'd like help with..." required></textarea>
                <button type="submit" class="btn btn-primary">Send request</button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });

    const form = modal.querySelector('#mentorRequestForm');
    form.addEventListener('submit', async event => {
        event.preventDefault();

        const expertise = document.getElementById('expertise').value;
        const message = document.getElementById('message').value.trim();

        if (!expertise || !message) {
            showAlert('Please complete all fields.', 'error');
            return;
        }

        const { error } = await supabaseClient.from('mentorship_requests').insert([{
            student_user_id: user.id,
            mentor_user_id: mentorId,
            expertise_area: expertise,
            message,
            status: 'pending',
            created_at: new Date().toISOString(),
        }]);

        if (error) {
            console.error('Request failed:', error);
            showAlert('Unable to send mentorship request.', 'error');
            return;
        }

        showAlert(`Request sent to ${mentorName}! They'll review it and get back to you soon.`, 'success');
        modal.remove();
        await initializeMentorshipPage(user);
    });
}

async function acceptMentorshipRequest(requestId, user) {
    const { error } = await supabaseClient
        .from('mentorship_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

    if (error) {
        console.error('Request acceptance failed:', error);
        showAlert('Unable to accept request.', 'error');
        return;
    }

    showAlert('Mentorship request accepted! You can now message your mentee.', 'success');
    await initializeMentorshipPage(user);
}

async function rejectMentorshipRequest(requestId, user) {
    const { error } = await supabaseClient
        .from('mentorship_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

    if (error) {
        console.error('Request rejection failed:', error);
        showAlert('Unable to decline request.', 'error');
        return;
    }

    showAlert('Mentorship request declined.', 'success');
    await initializeMentorshipPage(user);
}

async function openMentorshipMessaging(mentorshipId, mentorName, menteeId, user) {
    const messagingPanel = document.getElementById('messagingPanel');
    const messageHeader = document.getElementById('messageHeader');
    const messageThread = document.getElementById('messageThread');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');

    messageHeader.innerHTML = `<h3>Chat with ${mentorName}</h3>`;
    messageThread.innerHTML = '<p class="placeholder-text">Loading messages...</p>';
    messagingPanel.classList.remove('hidden');

    // Load messages
    const { data: messages, error } = await supabaseClient
        .from('mentorship_messages')
        .select('*')
        .eq('mentorship_request_id', mentorshipId)
        .order('created_at', { ascending: true });

    if (!error && messages) {
        messageThread.innerHTML = messages.length === 0
            ? '<p class="placeholder-text">No messages yet. Start the conversation!</p>'
            : messages.map(msg => `
                <div class="message ${msg.sender_id === user.id ? 'sent' : 'received'}">
                    <p>${msg.content}</p>
                    <small>${new Date(msg.created_at).toLocaleString()}</small>
                </div>
            `).join('');
    }

    // Handle form submission
    messageForm.classList.remove('hidden');
    messageForm.onsubmit = async (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content) return;

        const { error: msgError } = await supabaseClient.from('mentorship_messages').insert([{
            mentorship_request_id: mentorshipId,
            sender_id: user.id,
            content,
            created_at: new Date().toISOString(),
        }]);

        if (!msgError) {
            messageInput.value = '';
            await openMentorshipMessaging(mentorshipId, mentorName, menteeId, user);
        }
    };

    document.getElementById('closeMsgBtn').onclick = () => {
        messagingPanel.classList.add('hidden');
        messageForm.classList.add('hidden');
    };
}


async function initializeInterviewsPage(user) {
    const profile = await fetchProfile(user.id);
    const list = document.getElementById('interviewsList');
    const calendarPanel = document.getElementById('interviewCalendarPanel');
    const notificationsPanel = document.getElementById('interviewNotificationPanel');
    const notificationsList = document.getElementById('interviewNotifications');
    const formPanel = document.getElementById('interviewFormPanel');
    const interviewForm = document.getElementById('interviewForm');

    const isCompany = profile?.role === 'company';
    const isStudent = profile?.role === 'student';

    formPanel?.classList.toggle('hidden', !isCompany);
    calendarPanel?.classList.remove('hidden');
    notificationsPanel?.classList.toggle('hidden', !isStudent);

    let query = supabaseClient.from('interviews').select('*');
    if (isStudent) {
        query = query.eq('student_id', user.id);
    } else if (isCompany) {
        query = query.eq('company_id', user.id);
    }

    try {
        const { data: interviews, error } = await query.order('date', { ascending: true }).order('time', { ascending: true });
        if (error) throw error;

        const profileIds = [...new Set([...(interviews || []).flatMap(item => [item.student_id, item.company_id].filter(Boolean))])];
        const profileLookup = {};
        if (profileIds.length) {
            const { data: profiles, error: profileError } = await supabaseClient.from('profiles').select('id,name,organization,email').in('id', profileIds);
            if (!profileError && profiles) {
                profiles.forEach(p => profileLookup[p.id] = p);
            }
        }

        const now = new Date();
        const upcoming = (interviews || []).filter(item => {
            const dt = new Date(`${item.date}T${item.time}:00`);
            return dt > now && dt <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
        });

        if (isStudent) {
            notificationsList.innerHTML = upcoming.length > 0
                ? upcoming.map(item => renderNotificationCard(item, profileLookup, user)).join('')
                : '<p class="placeholder-text">No upcoming interview notifications in the next 24 hours.</p>';
        }

        if (!interviews || interviews.length === 0) {
            list.innerHTML = '<p class="placeholder-text">No interviews scheduled yet.</p>';
            calendarPanel.innerHTML = '<p class="placeholder-text">No interview calendar entries yet.</p>';
        } else {
            list.innerHTML = (interviews || []).map(item => renderInterviewCard(item, profileLookup, isStudent)).join('');
            calendarPanel.innerHTML = renderInterviewCalendar(interviews, profileLookup, isStudent);
        }
    } catch (error) {
        console.error('Interview fetch failed:', error);
        list.innerHTML = '<p class="placeholder-text">Unable to load interview schedule.</p>';
        calendarPanel.innerHTML = '<p class="placeholder-text">Unable to load interview calendar.</p>';
        notificationsList.innerHTML = '<p class="placeholder-text">Unable to load notifications.</p>';
    }

    if (interviewForm) {
        interviewForm.onsubmit = async event => {
            event.preventDefault();
            clearAlert();

            const interviewStudent = document.getElementById('interviewStudent')?.value.trim();
            const interviewDate = document.getElementById('interviewDate')?.value;
            const interviewTime = document.getElementById('interviewTime')?.value;
            const interviewLink = document.getElementById('interviewLink')?.value.trim();

            if (!interviewStudent || !interviewDate || !interviewTime || !interviewLink) {
                showAlert('Fill in all interview fields.', 'error');
                return;
            }

            const { data: studentProfile, error: studentError } = await supabaseClient.from('profiles').select('id').eq('email', interviewStudent).single();
            if (studentError || !studentProfile) {
                showAlert('Student email not found. Please verify the email address.', 'error');
                return;
            }

            const { error: insertError } = await supabaseClient.from('interviews').insert([{
                student_id: studentProfile.id,
                company_id: user.id,
                date: interviewDate,
                time: interviewTime,
                link: interviewLink,
                created_at: new Date().toISOString(),
            }]);

            if (insertError) {
                console.error('Interview insert failed:', insertError);
                showAlert('Unable to schedule interview.', 'error');
                return;
            }

            showAlert('Interview scheduled successfully.', 'success');
            interviewForm.reset();
            await initializeInterviewsPage(user);
        };
    }
}

function renderNotificationCard(item, profileLookup, user) {
    const company = profileLookup[item.company_id] || { name: 'Company' };
    const dt = formatInterviewDateTime(item.date, item.time);
    return `
        <article class="interview-notification-card">
            <h3>Upcoming interview</h3>
            <p>${dt} with ${company.name}</p>
            ${item.link ? `<a class="btn btn-secondary" href="${item.link}" target="_blank" rel="noreferrer">Join interview</a>` : ''}
        </article>
    `;
}

function renderInterviewCard(item, profileLookup, isStudent) {
    const student = profileLookup[item.student_id] || { name: item.student_id || 'Student' };
    const company = profileLookup[item.company_id] || { name: item.company_id || 'Company' };
    const dt = formatInterviewDateTime(item.date, item.time);
    const partnerLabel = isStudent ? 'Company' : 'Student';
    const partner = isStudent ? company : student;
    const joinLink = item.link ? `<a href="${item.link}" target="_blank" class="btn btn-secondary">Join interview</a>` : '<span class="placeholder-text">No meeting link provided.</span>';

    return `
        <article class="interview-card">
            <div class="interview-card-header">
                <h3>${dt}</h3>
                <span class="status-badge upcoming">Scheduled</span>
            </div>
            <p><strong>${partnerLabel}:</strong> ${partner.name}</p>
            <p><strong>Organization:</strong> ${partner.organization || 'N/A'}</p>
            <p>${joinLink}</p>
        </article>
    `;
}

function renderInterviewCalendar(interviews, profileLookup, isStudent) {
    const grouped = interviews.reduce((acc, item) => {
        const dateKey = item.date || 'TBD';
        acc[dateKey] = acc[dateKey] || [];
        acc[dateKey].push(item);
        return acc;
    }, {});

    return Object.entries(grouped).map(([date, items]) => `
        <div class="calendar-day">
            <h3>${formatDateLabel(date)}</h3>
            ${items.map(item => {
                const time = item.time || 'TBD';
                const company = profileLookup[item.company_id] || { name: 'Company' };
                const student = profileLookup[item.student_id] || { name: 'Student' };
                const partner = isStudent ? company : student;
                return `
                    <div class="calendar-item">
                        <span class="calendar-time">${time}</span>
                        <span>${isStudent ? 'Company:' : 'Student:'} ${partner.name}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');
}

function formatInterviewDateTime(date, time) {
    const dt = new Date(`${date}T${time}:00`);
    return isNaN(dt.getTime()) ? `${date} ${time}` : dt.toLocaleString();
}

function formatDateLabel(date) {
    const dt = new Date(date);
    return isNaN(dt.getTime()) ? date : dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function updateResumePreview(data) {
    const preview = document.getElementById('resumePreview');
    if (!preview) return;
    preview.innerHTML = `
        <h2>${data.name || 'Your name'}</h2>
        <p><strong>${data.title || 'Your professional title'}</strong></p>
        <p>${data.summary || 'Write a short professional summary here.'}</p>
        <h3>Education</h3>
        <p>${data.education || 'List your education details.'}</p>
        <h3>Experience</h3>
        <p>${data.experience || 'Describe your projects, internships, and roles.'}</p>
    `;
}

function initializeResumePage() {
    const form = document.getElementById('resumeForm');
    if (!form) return;

    form.addEventListener('submit', event => {
        event.preventDefault();
        const data = {
            name: document.getElementById('resumeName')?.value.trim(),
            title: document.getElementById('resumeTitle')?.value.trim(),
            summary: document.getElementById('resumeSummary')?.value.trim(),
            education: document.getElementById('resumeEducation')?.value.trim(),
            experience: document.getElementById('resumeExperience')?.value.trim(),
        };
        updateResumePreview(data);
        showAlert('Resume preview updated.', 'success');
    });
}

async function initializeForumPage(user) {
    const form = document.getElementById('forumForm');
    const threadArea = document.getElementById('forumThreads');

    const { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Forum fetch failed:', error);
        threadArea.innerHTML = '<p class="placeholder-text">Unable to load posts.</p>';
        return;
    }

    threadArea.innerHTML = posts.length
        ? posts.map(post => `
            <article class="post-card">
                <h3>${post.title}</h3>
                <p>${post.content}</p>
                <small>${post.created_at ? new Date(post.created_at).toLocaleString() : ''}</small>
            </article>
        `).join('')
        : '<p class="placeholder-text">No discussions yet. Start the conversation.</p>';

    form?.addEventListener('submit', async event => {
        event.preventDefault();
        const title = document.getElementById('postTitle')?.value.trim();
        const content = document.getElementById('postContent')?.value.trim();
        if (!title || !content) {
            showAlert('Complete both title and content.', 'error');
            return;
        }

        const { error: insertError } = await supabaseClient.from('posts').insert([{ user_id: user.id, title, content }]);
        if (insertError) {
            console.error('Post creation failed:', insertError);
            showAlert('Unable to publish post.', 'error');
            return;
        }

        showAlert('Post published successfully.', 'success');
        form.reset();
        await initializeForumPage(user);
    });
}

async function initializeAnalyticsPage() {
    const [projects, applications, results] = await Promise.all([
        supabaseClient.from('projects').select('*'),
        supabaseClient.from('applications').select('*'),
        supabaseClient.from('results').select('*'),
    ]);

    document.getElementById('metricProjects').textContent = projects.data?.length || '0';
    document.getElementById('metricApplications').textContent = applications.data?.length || '0';
    document.getElementById('metricTests').textContent = results.data?.length || '0';

    const chart = document.getElementById('analyticsChart');
    const values = [
        { label: 'Projects', value: projects.data?.length || 0 },
        { label: 'Applications', value: applications.data?.length || 0 },
        { label: 'Tests', value: results.data?.length || 0 },
        { label: 'Courses', value: (await supabaseClient.from('courses').select('*')).data?.length || 0 },
    ];

    const max = Math.max(...values.map(item => item.value), 1);
    chart.innerHTML = values.map(item => `
        <div class="chart-bar" style="height:${Math.max(100, (item.value / max) * 220)}px;">
            <span>${item.label}</span>
        </div>
    `).join('');
}

async function initializeHackathonsPage(user) {
    const list = document.getElementById('hackathonsList');
    const { data: hackathons, error } = await supabaseClient.from('hackathons').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Hackathons fetch failed:', error);
        list.innerHTML = '<p class="placeholder-text">Unable to load hackathons.</p>';
        return;
    }

    if (!hackathons.length) {
        list.innerHTML = '<p class="placeholder-text">No hackathons published yet.</p>';
        return;
    }

    list.innerHTML = hackathons.map(item => `
        <article class="hackathon-card">
            <h3>${item.title}</h3>
            <p>${item.description || 'Participate and submit solutions for review.'}</p>
            <button type="button" class="btn btn-secondary hackathon-register-btn" data-hackathon-id="${item.id}">Register</button>
        </article>
    `).join('');
}

async function registerHackathon(hackathonId, user) {
    const { error } = await supabaseClient.from('submissions').insert([{ hackathon_id: hackathonId, student_id: user.id, score: 0 }]);
    if (error) {
        console.error('Hackathon registration failed:', error);
        showAlert('Unable to register for the hackathon.', 'error');
        return;
    }
    showAlert('Registered for the hackathon successfully.', 'success');
}

async function uploadResumeFile(user, file) {
    if (!file) {
        throw new Error('No file selected');
    }

    const filePath = `resumes/${user.id}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabaseClient.storage.from('resumes').upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
    });

    if (error) {
        throw error;
    }

    const { data: signedUrlData, error: urlError } = await supabaseClient.storage.from('resumes').createSignedUrl(data.path, 60 * 60 * 24 * 7);
    if (urlError) {
        throw urlError;
    }

    return signedUrlData.signedUrl;
}

async function savePortfolioItem(user, title, description, link) {
    if (!title || !description || !link) {
        showAlert('Please complete all portfolio fields.', 'error');
        return false;
    }

    const { error } = await supabaseClient.from('portfolio').insert([{ student_id: user.id, title, description, link }]);
    if (error) {
        console.error('Portfolio save failed:', error);
        showAlert('Unable to save portfolio item.', 'error');
        return false;
    }

    return true;
}

async function saveResumeUrl(user, resumeUrl) {
    const { error } = await supabaseClient.from('profiles').upsert({ id: user.id, resume_url: resumeUrl });
    if (error) {
        console.error('Resume URL save failed:', error);
        showAlert('Unable to save resume link.', 'error');
        return false;
    }

    return true;
}

async function initializeProfilePage(user) {
    const profile = await fetchProfile(user.id);
    const meta = user.user_metadata || {};
    const displayProfile = {
        name: profile?.name || meta.name || meta.full_name || user.email,
        role: profile?.role || meta.role || 'N/A',
        organization: profile?.organization || meta.organization || meta.company || 'N/A',
        college: profile?.college || meta.college || 'N/A',
        phone: profile?.phone || meta.phone || 'N/A',
        resume_url: profile?.resume_url,
    };
    const details = document.getElementById('profileDetails');
    const portfolio = document.getElementById('portfolioList');
    const resumeDisplay = document.getElementById('resumeDisplay');
    const resumeForm = document.getElementById('resumeForm');
    const portfolioForm = document.getElementById('portfolioForm');

    details.innerHTML = `
        <div class="panel-item">
            <h3>${displayProfile.name}</h3>
            <p>Email: ${user.email}</p>
            <p>Role: ${displayProfile.role}</p>
            <p>Organization: ${displayProfile.organization}</p>
            <p>College: ${displayProfile.college}</p>
            <p>Phone: ${displayProfile.phone}</p>
        </div>
    `;

    resumeDisplay.innerHTML = profile?.resume_url
        ? `
            <article class="panel-item">
                <h3>Uploaded Resume</h3>
                <p><a href="${profile.resume_url}" target="_blank">View resume</a></p>
            </article>
        `
        : '<p class="placeholder-text">No resume uploaded yet.</p>';

    if (!profilePageListenersBound) {
        resumeForm?.addEventListener('submit', async event => {
            event.preventDefault();
            clearAlert();
            const fileInput = document.getElementById('resumeFile');
            const file = fileInput?.files?.[0];

            if (!file) {
                showAlert('Please select a resume file to upload.', 'error');
                return;
            }

            try {
                const resumeUrl = await uploadResumeFile(user, file);
                const saved = await saveResumeUrl(user, resumeUrl);
                if (saved) {
                    showAlert('Resume uploaded successfully.', 'success');
                    resumeDisplay.innerHTML = `
                        <article class="panel-item">
                            <h3>Uploaded Resume</h3>
                            <p><a href="${resumeUrl}" target="_blank">View resume</a></p>
                        </article>
                    `;
                    fileInput.value = '';
                }
            } catch (error) {
                console.error('Resume upload failed:', error);
                showAlert('Resume upload failed. Check your storage settings.', 'error');
            }
        });

        portfolioForm?.addEventListener('submit', async event => {
            event.preventDefault();
            clearAlert();

            const title = document.getElementById('portfolioTitle')?.value.trim();
            const description = document.getElementById('portfolioDescription')?.value.trim();
            const link = document.getElementById('portfolioLink')?.value.trim();

            const added = await savePortfolioItem(user, title, description, link);
            if (added) {
                showAlert('Portfolio item added.', 'success');
                portfolioForm.reset();
                await initializeProfilePage(user);
            }
        });

        profilePageListenersBound = true;
    }

    const { data: portfolioItems, error } = await supabaseClient.from('portfolio').select('*').eq('student_id', user.id);
    if (error || !portfolioItems.length) {
        portfolio.innerHTML = '<p class="placeholder-text">No portfolio items added yet.</p>';
        return;
    }

    portfolio.innerHTML = portfolioItems.map(item => `
        <article class="panel-item">
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <small><a href="${item.link}" target="_blank">View link</a></small>
        </article>
    `).join('');
}

async function initializePage() {
    const user = await ensurePageAccess();
    const page = getPageName();
    const logoutButton = document.getElementById('logoutBtn');

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    if (page === 'login.html') return initializeLoginPage();
    if (page === 'signup.html') return initializeSignupPage();
    if (page === 'dashboard.html' && user) return initializeDashboardPage(user);
    if (page === 'projects.html' && user) return initializeProjectsPage(user);
    if (page === 'applications.html' && user) return initializeApplicationsPage(user);
    if (page === 'courses.html' && user) return initializeCoursesPage(user);
    if (page === 'tests.html' && user) return initializeTestsPage(user);
    if (page === 'events.html' && user) return initializeEventsPage(user);
    if (page === 'mentorship.html' && user) return initializeMentorshipPage(user);
    if (page === 'interviews.html' && user) return initializeInterviewsPage(user);
    if (page === 'resume.html') return initializeResumePage();
    if (page === 'forum.html' && user) return initializeForumPage(user);
    if (page === 'analytics.html' && user) return initializeAnalyticsPage();
    if (page === 'hackathons.html' && user) return initializeHackathonsPage(user);
    if (page === 'profile.html' && user) return initializeProfilePage(user);
}

window.addEventListener('DOMContentLoaded', initializePage);

document.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;

    const user = await checkAuthStatus();
    if (!user) return;

    if (target.matches('.apply-btn')) {
        await applyToProject(target.dataset.projectId, user);
    }

    if (target.matches('.course-enroll-btn')) {
        await enrollCourse(target.dataset.courseId, user);
    }

    if (target.matches('.view-course-btn')) {
        await viewCourseDetail(target.dataset.courseId, user);
    }

    if (target.matches('.complete-course-btn')) {
        await updateCourseProgress(target.dataset.courseId, user);
    }

    if (target.matches('.download-cert-btn')) {
        const { data: course, error } = await supabaseClient.from('courses').select('*').eq('id', target.dataset.courseId).single();
        if (error || !course) {
            showAlert('Unable to retrieve course for certificate.', 'error');
            return;
        }
        const profile = await fetchProfile(user.id);
        downloadCourseCertificate(course, profile);
    }

    if (target.matches('#closeCourseDetail')) {
        const detailPanel = document.getElementById('courseDetailPanel');
        detailPanel?.classList.add('hidden');
    }

    if (target.matches('.start-test-btn')) {
        await loadTest(target.dataset.testId, user);
    }

    if (target.matches('#createSampleTestBtn')) {
        await createSampleTest(user);
    }

    if (target.matches('.register-event-btn')) {
        await registerEvent(target.dataset.eventId, user);
    }

    if (target.matches('.mark-attendance-btn')) {
        await markEventAttendance(target.dataset.eventId, user);
    }

    if (target.matches('.view-registrations-btn')) {
        await viewEventRegistrations(target.dataset.eventId);
    }

    if (target.matches('.request-mentor-btn')) {
        await requestMentorship(target.dataset.mentorId, target.dataset.mentorName, user);
    }

    if (target.matches('.open-mentorship-btn')) {
        const mentorData = target.dataset;
        await openMentorshipMessaging(mentorData.mentorshipId, mentorData.mentorName, mentorData.mentorId, user);
    }

    if (target.matches('.open-messaging-btn')) {
        const mentorData = target.dataset;
        await openMentorshipMessaging(mentorData.mentorshipId, mentorData.mentorName || mentorData.menteeName, mentorData.mentorId || mentorData.menteeId, user);
    }

    if (target.matches('.accept-request-btn')) {
        await acceptMentorshipRequest(target.dataset.requestId, user);
    }

    if (target.matches('.reject-request-btn')) {
        await rejectMentorshipRequest(target.dataset.requestId, user);
    }

    if (target.matches('.hackathon-register-btn')) {
        await registerHackathon(target.dataset.hackathonId, user);
    }
});
