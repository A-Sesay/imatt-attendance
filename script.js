// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBWNkOlYW2tS9pYg7HaB6c8E9PeRjmMl-8",
    authDomain: "imatt-attendance.firebaseapp.com",
    projectId: "imatt-attendance",
    storageBucket: "imatt-attendance.firebasestorage.app",
    messagingSenderId: "629926774336",
    appId: "1:629926774336:web:4f50984f244b75cda101a5",
    measurementId: "G-KLR6X3V9MK"
};

// --- 2. INITIALIZE FIREBASE (COMPAT) ---
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

const ADMIN_EMAIL = 'abdulaisesay167@gmail.com';
let currentClassId = null;
let currentStudentList = []; 

// --- 3. LOGIN LOGIC ---
function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    if (!email || !pass) return alert("Please enter email and password");

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            setupUI(userCredential.user);
        })
        .catch((error) => {
            btn.innerHTML = '<span>Sign In to Portal</span> <i class="fas fa-arrow-right"></i>';
            btn.disabled = false;
            errEl.style.display = 'block';
            errEl.innerText = "Login Failed: " + error.message;
        });
}

function setupUI(user) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainSystem').style.display = 'flex';
    
    const nameSpan = document.getElementById('displayName');
    
    if(user.email === ADMIN_EMAIL) {
        nameSpan.innerText = "Abdulai Sesay (Admin)";
        document.getElementById('adminOnlyLink').style.display = 'block';
    } else {
        db.collection("lecturers").where("email", "==", user.email).get().then(snap => {
            nameSpan.innerText = !snap.empty ? snap.docs[0].data().name : user.email;
        });
    }
    
    listenForClasses();
    showSection('dashboard');
}

// --- 4. NAVIGATION ---
function showSection(id) {
    const sections = ['dashboardSection','adminSection','classesSection','attendanceSection','recordsSection'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });
    
    const target = document.getElementById(id + 'Section');
    if(target) target.style.display = 'block';

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const navId = id === 'dashboard' ? 'nav-dash' : id === 'classes' ? 'nav-class' : 'nav-admin';
    const navEl = document.getElementById(navId);
    if(navEl) navEl.classList.add('active');
}

// --- 5. CLASS MANAGEMENT (DASHBOARD) ---
function listenForClasses() {
    const userEmail = auth.currentUser.email;
    let query;

    // ADMIN sees all. LECTURERS see only theirs.
    if (userEmail === ADMIN_EMAIL) {
        query = db.collection("classes");
    } else {
        query = db.collection("classes").where("ownerEmail", "==", userEmail);
    }

    query.onSnapshot(snapshot => {
        const grid = document.getElementById('classListItems');
        if(!grid) return;
        grid.innerHTML = '';
        document.getElementById('classCount').innerText = snapshot.size;
        
        snapshot.forEach(doc => {
            const c = doc.data();
            const deleteBtn = (userEmail === ADMIN_EMAIL) 
                ? `<button class="btn-logout" style="margin-top:15px; font-size: 12px; padding: 8px; border-color: #fc8181;" onclick="deleteClass('${doc.id}', '${c.module}')">
                    <i class="fas fa-trash"></i> Delete Module
                   </button>` : '';

            grid.innerHTML += `
                <div class="class-card">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <p style="color:var(--primary); font-weight:bold; font-size:11px; text-transform:uppercase; margin:0;">${c.dept}</p>
                        <span style="background:#edf2f7; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:bold;">YEAR ${c.year}</span>
                    </div>
                    <h3 style="margin: 12px 0; font-size: 1.2rem;">${c.module}</h3>
                    <p style="color:#718096; font-size: 0.85rem;"><i class="fas fa-users"></i> ${c.students ? c.students.length : 0} Students</p>
                    
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button class="btn-primary" style="flex:1; font-size:13px;" onclick="openAttendance('${doc.id}')">
                           <i class="fas fa-clipboard-check"></i> Register
                        </button>
                        <button class="btn-primary" style="flex:1; background:var(--accent); font-size:13px;" onclick="viewRecords('${doc.id}')">
                           <i class="fas fa-file-invoice"></i> Records
                        </button>
                    </div>
                    ${deleteBtn}
                </div>`;
        });
    });
}

function createNewClass() {
    const module = document.getElementById('module').value;
    const dept = document.getElementById('dept').value;
    const year = document.getElementById('year').value;

    if(!module || !dept) return alert("Please fill in module details");

    db.collection("classes").add({
        module, 
        dept, 
        year, 
        ownerEmail: auth.currentUser.email,
        students: [],
        totalSessions: 0
    }).then(() => {
        alert("Module Created Successfully!");
        document.getElementById('module').value = '';
        document.getElementById('dept').value = '';
        showSection('dashboard'); // Redirect to dashboard to see the new class
    });
}

function deleteClass(id, name) {
    if (confirm(`Are you sure you want to delete "${name}"? This will erase all attendance data forever.`)) {
        db.collection("classes").doc(id).delete()
            .then(() => alert("Module removed."))
            .catch(err => alert("Error: " + err.message));
    }
}

// --- 6. STUDENT & ATTENDANCE ---
function filterStudents() {
    const query = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = currentStudentList.filter(s => 
        s.name.toLowerCase().includes(query) || s.sid.toLowerCase().includes(query)
    );
    renderStudents(filtered);
}

function openAttendance(id) {
    currentClassId = id;
    showSection('attendance');
    document.getElementById('studentSearch').value = '';
    
    db.collection("classes").doc(id).get().then(doc => {
        const c = doc.data();
        document.getElementById('activeClassName').innerText = c.module;
        currentStudentList = c.students || [];
        renderStudents(currentStudentList);
    });
}

function addStudent() {
    const name = document.getElementById('stdName').value;
    const sid = document.getElementById('stdID').value;
    if(!name || !sid) return alert("Please enter Student Name and ID");

    db.collection("classes").doc(currentClassId).update({
        students: firebase.firestore.FieldValue.arrayUnion({ 
            sid, name, attended: 0 
        })
    }).then(() => {
        document.getElementById('stdName').value = '';
        document.getElementById('stdID').value = '';
        openAttendance(currentClassId);
    });
}

function renderStudents(students) {
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No students found.</td></tr>';
        return;
    }

    students.forEach(s => {
        tbody.innerHTML += `<tr>
            <td><strong>${s.sid}</strong></td>
            <td>${s.name}</td>
            <td class="center"><input type="radio" name="att-${s.sid}" value="p"></td>
            <td class="center"><input type="radio" name="att-${s.sid}" value="a"></td>
        </tr>`;
    });
}

function submitAttendance() {
    const btn = document.querySelector('.btn-submit');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

    db.collection("classes").doc(currentClassId).get().then(doc => {
        let students = doc.data().students;
        let sessions = (doc.data().totalSessions || 0) + 1;

        students.forEach(s => {
            const radio = document.querySelector(`input[name="att-${s.sid}"][value="p"]`);
            if(radio && radio.checked) {
                s.attended += 1;
            }
        });

        db.collection("classes").doc(currentClassId).update({ 
            students: students, 
            totalSessions: sessions 
        })
        .then(() => { 
            alert("Attendance synced for Session #" + sessions); 
            btn.innerHTML = originalText;
            showSection('dashboard'); 
        });
    });
}

// --- 7. RECORDS & ADMIN ---
function viewRecords(id) {
    showSection('records');
    db.collection("classes").doc(id).get().then(doc => {
        const c = doc.data();
        document.getElementById('recordTitle').innerText = "History: " + c.module;
        const tbody = document.getElementById('recordsTableBody');
        const total = c.totalSessions || 0;
        tbody.innerHTML = '';
        
        c.students.forEach(s => {
            const perc = total > 0 ? Math.round((s.attended/total)*100) : 0;
            tbody.innerHTML += `<tr>
                <td>${s.sid}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.attended} / ${total}</td>
                <td><span style="color:${perc < 75 ? '#d32f2f' : '#2f855a'}; font-weight:bold;">${perc}%</span></td>
            </tr>`;
        });
    });
}

function addLecturer() {
    const name = document.getElementById('lecName').value;
    const email = document.getElementById('lecEmail').value;
    if(!name || !email) return alert("Fill details");

    db.collection("lecturers").add({ name, email, role: 'lecturer' }).then(() => {
        alert("Lecturer saved!");
        document.getElementById('lecName').value = '';
        document.getElementById('lecEmail').value = '';
    });
}

function logout() { 
    auth.signOut().then(() => location.reload()); 
}