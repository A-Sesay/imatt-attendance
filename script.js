const DB_KEY = 'imatt_v6_db';
const USER_KEY = 'imatt_v6_users';
let currentClassId = null;
let loggedInUser = null;

// ADMIN CONFIGURATION
const ADMIN_EMAIL = 'abdulaisesay167@gmail.com';
const ADMIN_PASS = 'Mexcess25132513';

// LOGIN FUNCTION
function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const users = JSON.parse(localStorage.getItem(USER_KEY)) || [];

    // 1. Check if Admin
    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
        loggedInUser = { name: "Abdulai Sesay", email: ADMIN_EMAIL, role: 'admin' };
    } 
    // 2. Check if Lecturer
    else {
        const lecturer = users.find(u => u.email === email && u.pass === pass);
        if (lecturer) {
            loggedInUser = { name: lecturer.name, email: lecturer.email, role: 'lecturer' };
        }
    }

    if (loggedInUser) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainSystem').style.display = 'flex';
        document.getElementById('displayName').innerText = loggedInUser.name;
        
        // Show Admin menu only to you
        if (loggedInUser.role === 'admin') {
            document.getElementById('adminOnlyLink').style.display = 'block';
        }
        renderClasses();
    } else {
        const err = document.getElementById('loginError');
        err.style.display = 'block';
        err.innerText = "Access Denied: Invalid Credentials.";
    }
}

// ADMIN FUNCTION: Add Lecturer
function addLecturer() {
    const name = document.getElementById('lecName').value;
    const email = document.getElementById('lecEmail').value;
    const pass = document.getElementById('lecPass').value;

    if (!name || !email || !pass) return alert("All fields are required!");

    let users = JSON.parse(localStorage.getItem(USER_KEY)) || [];
    users.push({ name, email, pass });
    localStorage.setItem(USER_KEY, JSON.stringify(users));
    
    alert(`Lecturer ${name} added successfully!`);
    document.getElementById('lecName').value = '';
    document.getElementById('lecEmail').value = '';
    document.getElementById('lecPass').value = '';
}

// CLASS MANAGEMENT
function createNewClass() {
    const dept = document.getElementById('dept').value;
    const year = document.getElementById('year').value;
    const module = document.getElementById('module').value;
    const cap = document.getElementById('capacity').value;

    if (!dept || !year || !module || !cap) return alert("Please fill class details.");

    const newClass = { 
        id: Date.now(), 
        name: module, 
        dept, year, capacity: cap, 
        students: [], history: [] 
    };

    let db = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    db.push(newClass);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // Clear inputs
    ['dept', 'module', 'capacity'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('year').value = '';
    renderClasses();
}

function renderClasses() {
    const grid = document.getElementById('classListItems');
    const db = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    grid.innerHTML = '';
    db.forEach(c => {
        grid.innerHTML += `
            <div class="class-card">
                <h3>${c.name}</h3>
                <p>${c.dept} | Year ${c.year}</p>
                <p style="font-size: 0.8rem; color: #888;">Capacity: ${c.capacity}</p>
                <button class="btn-primary" style="width:100%; margin-top:10px;" onclick="openAttendance(${c.id})">Open Register</button>
                <button class="btn-secondary" style="width:100%; margin-top:5px;" onclick="viewRecords(${c.id})">View Log</button>
            </div>`;
    });
    document.getElementById('classCount').innerText = db.length;
}

// NAVIGATION
function showSection(section) {
    const secs = ['dashboardSection', 'adminSection', 'classesSection', 'attendanceSection', 'recordsSection'];
    secs.forEach(s => document.getElementById(s).style.display = 'none');
    document.getElementById(section + 'Section').style.display = 'block';
    
    // Update active nav links
    document.querySelectorAll('.sidebar ul li a').forEach(a => a.classList.remove('active'));
    document.getElementById('nav-' + section.replace('Section',''))?.classList.add('active');
}

// ATTENDANCE LOGIC
function openAttendance(id) {
    currentClassId = id;
    const db = JSON.parse(localStorage.getItem(DB_KEY));
    const activeClass = db.find(c => c.id === id);
    showSection('attendance');
    document.getElementById('activeClassName').innerText = `Register: ${activeClass.name}`;
    renderStudents();
}

function addStudentToClass() {
    const name = document.getElementById('stdName').value;
    const sid = document.getElementById('stdID').value;
    if (!name || !sid) return alert("Student info missing.");

    let db = JSON.parse(localStorage.getItem(DB_KEY));
    const idx = db.findIndex(c => c.id === currentClassId);
    db[idx].students.push({ sid, name });
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    document.getElementById('stdName').value = '';
    document.getElementById('stdID').value = '';
    renderStudents();
}

function renderStudents() {
    const db = JSON.parse(localStorage.getItem(DB_KEY));
    const activeClass = db.find(c => c.id === currentClassId);
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = activeClass.students.length ? '' : '<tr><td colspan="4">No students yet.</td></tr>';

    activeClass.students.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${s.sid}</strong></td>
                <td>${s.name}</td>
                <td><input type="radio" name="att-${s.sid}" value="p"></td>
                <td><input type="radio" name="att-${s.sid}" value="a"></td>
            </tr>`;
    });
}

function saveAttendanceSession() {
    const rows = document.querySelectorAll('#attendanceTableBody tr');
    let p = 0, a = 0;
    rows.forEach(row => {
        if(row.querySelector('input[value="p"]')?.checked) p++;
        else if(row.querySelector('input[value="a"]')?.checked) a++;
    });

    if(p + a === 0) return alert("Mark attendance first!");

    let db = JSON.parse(localStorage.getItem(DB_KEY));
    const idx = db.findIndex(c => c.id === currentClassId);
    db[idx].history.push({ date: new Date().toLocaleDateString(), present: p, absent: a });
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    alert(`Submission Saved! Present: ${p}, Absent: ${a}`);
    showSection('dashboard');
}

function viewRecords(id) {
    const db = JSON.parse(localStorage.getItem(DB_KEY));
    const activeClass = db.find(c => c.id === id);
    showSection('records');
    document.getElementById('recordTitle').innerText = "History: " + activeClass.name;
    const tbody = document.getElementById('recordsTableBody');
    tbody.innerHTML = activeClass.history.length ? '' : '<tr><td colspan="4">No records yet.</td></tr>';
    
    activeClass.history.forEach(h => {
        tbody.innerHTML += `<tr><td>${h.date}</td><td>${h.present}</td><td>${h.absent}</td><td>${h.present + h.absent}</td></tr>`;
    });
}