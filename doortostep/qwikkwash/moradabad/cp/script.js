// ==================== CONFIG ====================
const BASE_URL = 'https://app.vbo.co.in';
const BRANCH_CITY = 'Moradabad';
const BRANCH_CITY_QUERY = encodeURIComponent(BRANCH_CITY);
const READ_ONLY = true;
let currentDB = 'user';
let currentTable = 'bookings';
let editId = null;
let editItemData = null;
let deleteItemData = null;
let allTableData = [];
let filteredData = [];
let activeStatusFilter = 'all';
let activeDateFrom = '';
let activeDateTo = '';
let activeCityFilter = 'all';
let activeEmployeeFilter = 'all';
let employeeLookup = {};
let partnerLookup = {};

const viewCopy = {
    bookings: {
        title: 'Branch Bookings',
        subtitle: 'Read-only Moradabad bookings from the Rampur head office system.',
        addLabel: 'Add Booking'
    },
    employees: {
        title: 'Moradabad Team',
        subtitle: 'Read-only branch team, skills, salary, and active status.',
        addLabel: 'Add Team Member'
    },
    attendance: {
        title: 'Attendance',
        subtitle: 'Review Moradabad team attendance by date and employee.',
        addLabel: 'Add Attendance'
    },
    jobs: {
        title: 'Assignments',
        subtitle: 'Monitor Moradabad job ownership, progress, and completion status.',
        addLabel: 'Add Assignment'
    },
    partners: {
        title: 'Branch Profile',
        subtitle: 'Read-only Moradabad partner profile from Rampur head office.',
        addLabel: 'Add Partner'
    },
    partner_services: {
        title: 'Branch Services',
        subtitle: 'Read-only Moradabad service menu, pricing, coupons, and availability.',
        addLabel: 'Add Service'
    },
    services: {
        title: 'Services',
        subtitle: 'Read-only Moradabad service catalogue.',
        addLabel: 'Add Service'
    }
};

// ==================== TABLE CONFIGURATION ====================
const tableConfig = {
    user: {
        services: {
            name: 'Services',
            url: `${BASE_URL}/kwikkwash/services?city=${BRANCH_CITY_QUERY}`,
            columns: ['service_code', 'service_name', 'partner_code', 'price', 'active', 'created_at'],
            idField: 'service_code',
            idType: 'single',
            getDropdowns: async () => {
                const partnersResponse = await fetch(`${BASE_URL}/kwikkwash/partners?city=${BRANCH_CITY_QUERY}`);
                const partners = await partnersResponse.json();
                return { partners };
            },
            addForm: (dropdowns) => `
                <div class="form-group">
                    <label class="required">Service Code</label>
                    <input type="text" id="service_code" placeholder="e.g., DRY wash" required>
                </div>
                <div class="form-group">
                    <label class="required">Service Name</label>
                    <input type="text" id="service_name" placeholder="e.g., Dry Wash Service" required>
                </div>
                <div class="form-group">
                    <label class="required">Partner Code **</label>
                    <select id="partner_code" required>
                        <option value="">Select Partner</option>
                        ${dropdowns.partners?.map(p => `<option value="${p.partner_code}">${p.partner_code} - ${p.franchise_name || p.owner_name} (${p.city})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Price (Rs)</label>
                    <input type="number" id="price" step="0.01" value="0" required>
                </div>
                <div class="form-group">
                    <label class="required">Status</label>
                    <select id="active" required>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                    </select>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/services`,
            deleteUrl: (id) => `${BASE_URL}/kwikkwash/services/${id}`
        },
        bookings: {
            name: 'Bookings',
            url: `${BASE_URL}/kwikkwash/bookings?city=${BRANCH_CITY_QUERY}`,
            columns: ['booking_id', 'customer_name', 'phone', 'city', 'service_code', 'assigned_employee_code', 'booking_date', 'status'],
            idField: 'booking_id',
            idType: 'single',
            getDropdowns: async () => {
                const [servicesResponse, employeesResponse] = await Promise.all([
                    fetch(`${BASE_URL}/kwikkwash/services?city=${BRANCH_CITY_QUERY}`),
                    fetch(`${BASE_URL}/kwikkwash/employees?city=${BRANCH_CITY_QUERY}`)
                ]);
                const services = await servicesResponse.json();
                const employees = await employeesResponse.json();
                return { services, employees };
            },
            addForm: (dropdowns) => `
                <div class="form-group">
                    <label class="required">Booking ID</label>
                    <input type="text" id="booking_id" required>
                </div>
                <div class="form-group">
                    <label class="required">Customer Name</label>
                    <input type="text" id="customer_name" required>
                </div>
                <div class="form-group">
                    <label class="required">Phone</label>
                    <input type="tel" id="phone" pattern="[0-9]{10}" placeholder="Enter 10-digit mobile number" required>
                    <small style="color: var(--text-muted);">10-digit mobile number</small>
                </div>
                <div class="form-group">
                    <label class="required">City</label>
                    <input type="text" id="city" required>
                </div>
                <div class="form-group">
                    <label class="required">Service</label>
                    <select id="service_code" required>
                        <option value="">Select Service</option>
                        ${dropdowns.services?.map(s => `<option value="${s.service_code}">${s.service_code} - ${s.service_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Assigned Employee</label>
                    <select id="assigned_employee_code" required>
                        <option value="">Select Employee</option>
                        ${dropdowns.employees?.map(e => `<option value="${e.employee_code}">${e.employee_code} - ${e.employee_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Booking Date</label>
                    <input type="date" id="booking_date" required>
                </div>
                <div class="form-group">
                    <label class="required">Status</label>
                    <select id="status" required>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/bookings`,
            deleteUrl: (id) => `${BASE_URL}/kwikkwash/bookings/${id}`
        }
    },
    employee: {
        employees: {
            name: 'Team Members',
            url: `${BASE_URL}/kwikkwash/employees?city=${BRANCH_CITY_QUERY}`,
            columns: ['id', 'employee_code', 'employee_name', 'phone', 'city', 'partner_code', 'joining_date', 'ref_by', 'background', 'allowed_lat', 'allowed_lng', 'allowed_range', 'salary', 'active', 'skills'],
            idField: 'employee_code',
            idType: 'single',
            getDropdowns: async () => {
                const partnersResponse = await fetch(`${BASE_URL}/kwikkwash/partners?city=${BRANCH_CITY_QUERY}`);
                const partners = await partnersResponse.json();
                return { partners };
            },
            addForm: (dropdowns) => `
                <div class="form-group">
                    <label class="required">Employee Code</label>
                    <input type="text" id="employee_code" required>
                </div>
                <div class="form-group">
                    <label class="required">Employee Name</label>
                    <input type="text" id="employee_name" required>
                </div>
                <div class="form-group">
                    <label class="required">Phone</label>
                    <input type="tel" id="phone" pattern="[0-9]{10}" placeholder="Enter 10-digit mobile number" required>
                    <small style="color: var(--text-muted);">10-digit mobile number</small>
                </div>
                <div class="form-group">
                    <label class="required">Partner Code **</label>
                    <select id="partner_code" required onchange="updateSkillsByPartner(this.value)">
                        <option value="">Select Partner</option>
                        ${dropdowns.partners?.map(p => `<option value="${p.partner_code}">${p.partner_code} - ${p.franchise_name || p.owner_name} (${p.city})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Joining Date</label>
                    <input type="date" id="joining_date" required>
                </div>
                <div class="form-group">
                    <label class="required">Referred By</label>
                    <input type="text" id="ref_by" placeholder="Person who referred this employee" required>
                </div>
                <div class="form-group">
                    <label class="required">Background Check</label>
                    <select id="background" required>
                        <option value="">Select Status</option>
                        <option value="clear">Clear</option>
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Allowed Latitude</label>
                    <input type="number" step="0.000001" id="allowed_lat" placeholder="e.g., 28.6139" required>
                </div>
                <div class="form-group">
                    <label class="required">Allowed Longitude</label>
                    <input type="number" step="0.000001" id="allowed_lng" placeholder="e.g., 77.2090" required>
                </div>
                <div class="form-group">
                    <label class="required">Allowed Range (Mtr)</label>
                    <input type="number" id="allowed_range" step="0.1" placeholder="e.g., 5" required>
                </div>
                <div class="form-group">
                    <label class="required">Salary (Rs)</label>
                    <input type="number" id="salary" step="0.01" placeholder="e.g., 25000" required>
                </div>
                <div class="form-group">
                    <label>Skills</label>
                    
                    <!-- hidden input for backend -->
                    <input type="hidden" id="skills">
                    
                    <!-- table render -->
                    <div id="skills-table-container" style="max-height:200px; overflow:auto; border:1px solid #333; border-radius:8px; padding:10px;">
                        <p>Select partner to load services</p>
                    </div>
                </div>
                <div class="form-group">
                    <label class="required">Status</label>
                    <select id="active" required>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                    </select>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/employees`,
            deleteUrl: (id) => `${BASE_URL}/kwikkwash/employees/${id}`
        },
        attendance: {
            name: 'Attendance',
            url: `${BASE_URL}/kwikkwash/attendance/all`,
            columns: ['id', 'employee_code', 'attendance_date', 'in_time', 'out_time'],
            idField: 'id',
            idType: 'single',
            getDropdowns: async () => {
                const response = await fetch(`${BASE_URL}/kwikkwash/employees?city=${BRANCH_CITY_QUERY}`);
                const employees = await response.json();
                return { employees };
            },
            addForm: (dropdowns) => `
                <div class="form-group">
                    <label class="required">Team Member</label>
                    <select id="employee_code" required>
                        <option value="">Select Team Member</option>
                        ${dropdowns.employees?.map(e => `<option value="${e.employee_code}">${e.employee_code} - ${e.employee_name} (${e.city || 'No city'})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Date</label>
                    <input type="date" id="attendance_date" required>
                </div>
                <div class="form-group">
                    <label class="required">In Time</label>
                    <input type="text" id="in_time" placeholder="09:00" required>
                </div>
                <div class="form-group">
                    <label class="required">Out Time</label>
                    <input type="text" id="out_time" placeholder="18:00" required>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/attendance`,
            deleteUrl: (item) => `${BASE_URL}/kwikkwash/attendance/${item.employee_code}/${item.attendance_date}`
        },
        jobs: {
            name: 'Assignments',
            url: `${BASE_URL}/kwikkwash/employee-jobs/all`,
            columns: ['id', 'employee_code', 'booking_id', 'status', 'job_address', 'created_at'],
            idField: 'id',
            idType: 'single',
            getDropdowns: async () => {
                const [empResponse, bookResponse] = await Promise.all([
                    fetch(`${BASE_URL}/kwikkwash/employees?city=${BRANCH_CITY_QUERY}`),
                    fetch(`${BASE_URL}/kwikkwash/bookings?city=${BRANCH_CITY_QUERY}`)
                ]);
                const employees = await empResponse.json();
                const bookings = await bookResponse.json();
                return { employees, bookings };
            },
            addForm: (dropdowns) => `
                <div class="form-group">
                    <label class="required">Team Member</label>
                    <select id="employee_code" required>
                        <option value="">Select Team Member</option>
                        ${dropdowns.employees?.map(e => `<option value="${e.employee_code}">${e.employee_code} - ${e.employee_name} (${e.city || 'No city'})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Booking</label>
                    <select id="booking_id" required>
                        <option value="">Select Booking</option>
                        ${dropdowns.bookings?.map(b => `<option value="${b.booking_id}">${b.booking_id} - ${b.customer_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Job Address</label>
                    <textarea id="job_address" rows="2" placeholder="Full address..." required></textarea>
                </div>
                <div class="form-group">
                    <label>Service Code</label>
                    <input type="text" id="service_code" placeholder="e.g., WASH001">
                </div>
                <div class="form-group">
                    <label class="required">Status</label>
                    <select id="status" required>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/employee-jobs`,
            deleteUrl: (id) => `${BASE_URL}/kwikkwash/employee-jobs/${id}`
        }
    },
    partner: {
        partners: {
            name: 'Branch Profile',
            url: `${BASE_URL}/kwikkwash/partners?city=${BRANCH_CITY_QUERY}`,
            columns: ['id', 'partner_code', 'franchise_name', 'owner_name', 'phone', 'city', 'business_type', 'office_lat', 'office_lng', 'service_range_km', 'active'],
            idField: 'id',
            idType: 'single',
            getDropdowns: async () => ({}),
            addForm: (dropdowns) => `
                <div class="form-group">
                    <label class="required">Partner Code</label>
                    <input type="text" id="partner_code" required>
                </div>
                <div class="form-group">
                    <label class="required">Franchise Name</label>
                    <input type="text" id="franchise_name" required>
                </div>
                <div class="form-group">
                    <label class="required">Owner Name</label>
                    <input type="text" id="owner_name" required>
                </div>
                <div class="form-group">
                    <label class="required">Phone</label>
                    <input type="tel" id="phone" pattern="[0-9]{10}" placeholder="Enter 10-digit mobile number" required>
                    <small style="color: var(--text-muted);">10-digit mobile number</small>
                </div>
                <div class="form-group">
                    <label class="required">City</label>
                    <input type="text" id="city" required>
                </div>
                <div class="form-group">
                    <label class="required">Business Type</label>
                    <select id="business_type" required>
                        <option value="">Select Business Type</option>
                        <option value="franchise">Franchise</option>
                        <option value="independent">Independent</option>
                        <option value="distributor">Distributor</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="required">Office Latitude</label>
                    <input type="number" step="0.000001" id="office_lat" placeholder="e.g., 28.6139" required>
                </div>
                <div class="form-group">
                    <label class="required">Office Longitude</label>
                    <input type="number" step="0.000001" id="office_lng" placeholder="e.g., 77.2090" required>
                </div>
                <div class="form-group">
                    <label class="required">Service Range (km)</label>
                    <input type="number" id="service_range_km" step="0.1" placeholder="e.g., 10" required>
                </div>
                <div class="form-group">
                    <label class="required">Status</label>
                    <select id="active" required>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                    </select>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/partners`,
            deleteUrl: (id) => `${BASE_URL}/kwikkwash/partners/${id}`
        },
        partner_services: {
            name: 'Branch Services',
            url: `${BASE_URL}/kwikkwash/partner-services/all?partner_code=`,
            columns: [
                'id',
                'partner_code',
                'service_code',
                'units',
                'short_details',
                'long_details',
                'coupon_code',
                'coupon_count',
                'price',
                'active'
            ],
            idField: 'id',
            idType: 'single',
            getDropdowns: async () => {
                const partnerResponse = await fetch(`${BASE_URL}/kwikkwash/partners?city=${BRANCH_CITY_QUERY}`);
                const partners = await partnerResponse.json();
                return { partners };
            },
            addForm: (dropdowns) => `
                <!-- HIDDEN ID FIELD -->
                <input type="hidden" id="id">
                
                <div class="form-group">
                    <label class="required">Partner</label>
                    <select id="partner_code" required>
                        <option value="">Select Partner</option>
                        ${dropdowns.partners?.map(p => `
                            <option value="${p.partner_code}">
                                ${p.partner_code} - ${p.franchise_name || p.owner_name} (${p.city})
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="required">Service Name</label>
                    <input type="text" id="service_code" required>
                </div>

                <div class="form-group">
                    <label>Work units (10 mnts)</label>
                    <input type="number" id="units">
                </div>

                <div class="form-group">
                    <label>Service intro</label>
                    <input type="text" id="short_details">
                </div>

                <div class="form-group">
                    <label>Service full details</label>
                    <textarea id="long_details" rows="3"></textarea>
                </div>

                <div class="form-group">
                    <label>Coupon</label>
                    <input type="text" id="coupon_code">
                </div>

                <div class="form-group">
                    <label>Discount amount</label>
                    <input type="number" id="coupon_count">
                </div>

                <div class="form-group">
                    <label class="required">Price (Rs)</label>
                    <input type="number" id="price" step="0.01" value="0" required>
                </div>

                <div class="form-group">
                    <label class="required">Status</label>
                    <select id="active" required>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                    </select>
                </div>
            `,
            addEndpoint: `${BASE_URL}/kwikkwash/partner-services`,
            deleteUrl: (id) => `${BASE_URL}/kwikkwash/partner-services/${id}`
        }
    }
};

// ==================== UPDATE SKILLS BASED ON PARTNER CODE ====================
async function updateSkillsByPartner(partnerCode) {
    const container = document.getElementById('skills-table-container');
    const hiddenInput = document.getElementById('skills');

    if (!container) return;
    
    if (hiddenInput && !editId) {
        hiddenInput.value = '';
    }

    if (!partnerCode) {
        container.innerHTML = '<p>Select partner to load services</p>';
        return;
    }

    try {
        container.innerHTML = '<p>Loading services...</p>';

        const res = await fetch(`${BASE_URL}/kwikkwash/partner-services/all?partner_code=${partnerCode}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p>No services found for this partner</p>';
            return;
        }

        const existingSkills = hiddenInput?.value
            ? hiddenInput.value.split(',').map(s => s.trim())
            : [];

        let html = `
            <table style="width:100%; font-size:12px;">
                <thead>
                    <tr>
                        <th>Select</th>
                        <th>Service</th>
                        <th>Price</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(item => {
            const checked = existingSkills.includes(item.service_code);

            html += `
                <tr>
                    <td><input type="checkbox" value="${item.service_code}" ${checked ? 'checked' : ''} onchange="updateSkillsValue()"></td>
                    <td>${item.service_code}</td>
                    <td>Rs ${item.price || 0}</td>
                    <td>${item.active == 1 ? 'Active' : 'Inactive'}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p>Error loading services</p>';
    }
}

// ==================== UPDATE SKILLS VALUE FROM CHECKBOXES ====================
function updateSkillsValue() {
    const checked = document.querySelectorAll('#skills-table-container input:checked');
    const values = Array.from(checked).map(cb => cb.value);

    const hiddenInput = document.getElementById('skills');
    if (hiddenInput) {
        hiddenInput.value = values.join(',');
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebar = () => {
        document.body.classList.remove('sidebar-open');
        menuToggle?.setAttribute('aria-expanded', 'false');
    };
    const toggleSidebar = () => {
        const isOpen = document.body.classList.toggle('sidebar-open');
        menuToggle?.setAttribute('aria-expanded', String(isOpen));
    };

    menuToggle?.addEventListener('click', toggleSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    document.querySelectorAll('.db-nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.db-nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDB = btn.dataset.db;
            updateTableSelector();
            closeSidebar();
        });
    });
    
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearch);
    
    document.getElementById('clearSearch').addEventListener('click', () => {
        searchInput.value = '';
        handleSearch();
        searchInput.focus();
    });
    
    document.getElementById('closeDeleteModal')?.addEventListener('click', closeDeleteModal);
    document.getElementById('cancelDelete')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDelete')?.addEventListener('click', confirmDelete);
    
    updateTableSelector();
});

// ==================== UPDATE TABLE SELECTOR ====================
function updateTableSelector() {
    const selector = document.getElementById('tableSelector');
    const tables = currentDB === 'user'
        ? ['bookings']
        : Object.keys(tableConfig[currentDB]);
    
    selector.innerHTML = '';
    tables.forEach((table, index) => {
        const btn = document.createElement('button');
        btn.textContent = tableConfig[currentDB][table].name;
        btn.className = index === 0 ? 'active' : '';
        btn.onclick = () => {
            document.querySelectorAll('#tableSelector button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTable = table;
            updateViewChrome();
            loadData();
            document.body.classList.remove('sidebar-open');
            document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'false');
        };
        selector.appendChild(btn);
    });
    
    currentTable = tables[0];
    updateViewChrome();
    loadData();
}

function updateViewChrome() {
    const config = tableConfig[currentDB][currentTable];
    const copy = viewCopy[currentTable] || {
        title: config.name,
        subtitle: 'Manage operational records for this workspace.',
        addLabel: `Add ${config.name}`
    };

    document.getElementById('workspaceTitle').textContent = copy.title;
    document.getElementById('workspaceSubtitle').textContent = copy.subtitle;
    document.getElementById('tableTitle').textContent = config.name;
}

// ==================== VIEW HELPERS ====================
function isDenseView() {
    return ['bookings', 'employees', 'jobs', 'partner_services', 'attendance'].includes(currentTable);
}

function normalizeCity(value) {
    return String(value || '').trim().toLowerCase();
}

function belongsToBranch(item) {
    const directCity = item.city || item.employee_city;
    if (directCity) return normalizeCity(directCity) === normalizeCity(BRANCH_CITY);

    if (item.employee_code && employeeLookup[item.employee_code]) {
        return normalizeCity(employeeLookup[item.employee_code].city) === normalizeCity(BRANCH_CITY);
    }

    if (item.partner_code && partnerLookup[item.partner_code]) {
        return normalizeCity(partnerLookup[item.partner_code].city) === normalizeCity(BRANCH_CITY);
    }

    return false;
}

function getStatusValue(item) {
    if (item.status) return String(item.status).toLowerCase();
    if (item.active !== undefined && item.active !== null) return item.active == 1 ? 'active' : 'inactive';
    return 'unknown';
}

function getDateValue(item) {
    return item.booking_date || item.attendance_date || item.created_at || item.assigned_at || item.duty_in_time || '';
}

function normalizeBooking(item) {
    return {
        ...item,
        customer_label: item.customer_name || item.phone || '-',
        service_label: item.service_code || item.services || '-',
        amount_label: item.total_amount || item.amount || 0,
        slot_label: item.slot || item.booking_time || '-'
    };
}

async function loadEmployeeLookup() {
    try {
        const res = await fetch(`${BASE_URL}/kwikkwash/employees?city=${BRANCH_CITY_QUERY}`);
        const employees = await res.json();
        employeeLookup = {};
        if (Array.isArray(employees)) {
            employees.forEach(emp => {
                employeeLookup[emp.employee_code] = emp;
            });
        }
    } catch (error) {
        employeeLookup = {};
    }
}

async function loadPartnerLookup() {
    try {
        const res = await fetch(`${BASE_URL}/kwikkwash/partners?city=${BRANCH_CITY_QUERY}`);
        const partners = await res.json();
        partnerLookup = {};
        if (Array.isArray(partners)) {
            partners.forEach(partner => {
                partnerLookup[partner.partner_code] = partner;
            });
        }
    } catch (error) {
        partnerLookup = {};
    }
}

async function enrichDataForCurrentView(data) {
    if (!Array.isArray(data)) return [];

    if (currentTable === 'bookings') {
        return data.map(normalizeBooking).filter(belongsToBranch);
    }

    if (currentTable === 'jobs' || currentTable === 'attendance') {
        await loadEmployeeLookup();
        return data.map(item => {
            const emp = employeeLookup[item.employee_code] || {};
            return {
                ...item,
                employee_name: emp.employee_name || item.employee_name || '-',
                employee_city: emp.city || item.employee_city || '-'
            };
        }).filter(belongsToBranch);
    }

    if (currentTable === 'partner_services') {
        await loadPartnerLookup();
        return data.map(item => {
            const partner = partnerLookup[item.partner_code] || {};
            return {
                ...item,
                city: partner.city || item.city || '-',
                partner_name: partner.franchise_name || partner.owner_name || '-'
            };
        }).filter(belongsToBranch);
    }

    return data.filter(belongsToBranch);
}

function resetViewFilters() {
    activeStatusFilter = 'all';
    activeDateFrom = '';
    activeDateTo = '';
    activeCityFilter = 'all';
    activeEmployeeFilter = 'all';
}

function applyViewFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    filteredData = allTableData.filter(item => {
        if (activeStatusFilter !== 'all' && getStatusValue(item) !== activeStatusFilter) return false;

        if (activeCityFilter !== 'all') {
            const city = String(item.city || item.employee_city || '').toLowerCase();
            if (city !== activeCityFilter.toLowerCase()) return false;
        }

        if (activeEmployeeFilter !== 'all') {
            if (String(item.employee_code || '') !== activeEmployeeFilter) return false;
        }

        const dateValue = String(getDateValue(item)).slice(0, 10);
        if (activeDateFrom && (!dateValue || dateValue < activeDateFrom)) return false;
        if (activeDateTo && (!dateValue || dateValue > activeDateTo)) return false;

        if (!searchTerm) return true;
        return Object.values(item).some(value => {
            if (value === null || value === undefined) return false;
            return value.toString().toLowerCase().includes(searchTerm);
        });
    });

    renderFilterBar();
    renderFilteredTableV2();
    updateSummary(filteredData);
    document.getElementById('recordCount').textContent =
        `${filteredData.length} of ${allTableData.length} records`;
}

function renderFilterBar() {
    const existing = document.getElementById('viewFilters');
    if (existing) existing.remove();

    const card = document.querySelector('.data-card');
    if (!card || !isDenseView()) return;

    const statuses = Array.from(new Set(allTableData.map(getStatusValue))).filter(Boolean);
    const cities = Array.from(new Set(allTableData.map(item => item.city || item.employee_city).filter(Boolean))).sort();
    const employees = Array.from(new Map(
        allTableData
            .filter(item => item.employee_code)
            .map(item => [
                item.employee_code,
                `${item.employee_code} - ${item.employee_name || 'Unknown'}${item.employee_city ? ` (${item.employee_city})` : ''}`
            ])
    ).entries());
    const hasDateValues = allTableData.some(item => String(getDateValue(item) || '').trim());
    const dateLabel = currentTable === 'bookings'
        ? 'Booking date'
        : currentTable === 'attendance'
            ? 'Attendance date'
            : 'Date';

    const counts = { all: allTableData.length };
    statuses.forEach(status => {
        counts[status] = allTableData.filter(item => getStatusValue(item) === status).length;
    });

    const tabs = ['all', ...statuses].map(status => `
        <button class="filter-tab ${activeStatusFilter === status ? 'active' : ''}" data-status="${status}">
            ${status.replace(/_/g, ' ')} <span>${counts[status] || 0}</span>
        </button>
    `).join('');

    const cityControl = cities.length ? `
        <select id="cityViewFilter" class="compact-select">
            <option value="all">All cities</option>
            ${cities.map(city => `<option value="${city}" ${activeCityFilter === city ? 'selected' : ''}>${city}</option>`).join('')}
        </select>
    ` : '';
    const employeeControl = (currentTable === 'attendance' || currentTable === 'jobs') && employees.length ? `
        <select id="employeeViewFilter" class="compact-select">
            <option value="all">All employees</option>
            ${employees.map(([code, label]) => `<option value="${code}" ${activeEmployeeFilter === code ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
    ` : '';
    const dateControls = hasDateValues ? `
        <label>${dateLabel}</label>
        <input type="date" id="dateFromFilter" value="${activeDateFrom}" title="From date">
        <span>to</span>
        <input type="date" id="dateToFilter" value="${activeDateTo}" title="To date">
    ` : '';

    const bar = document.createElement('div');
    bar.id = 'viewFilters';
    bar.className = 'view-filters';
    bar.innerHTML = `
        <div class="filter-tabs">${tabs}</div>
        <div class="filter-controls">
            ${cityControl}
            ${employeeControl}
            ${dateControls}
            <button class="btn-secondary compact-btn" id="clearViewFilters">Clear</button>
            <button class="btn-primary compact-btn" id="downloadCsvBtn">CSV</button>
        </div>
    `;

    card.insertBefore(bar, card.querySelector('.card-body'));

    bar.querySelectorAll('.filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeStatusFilter = btn.dataset.status;
            applyViewFilters();
        });
    });

    const citySelect = document.getElementById('cityViewFilter');
    if (citySelect) citySelect.addEventListener('change', e => {
        activeCityFilter = e.target.value;
        applyViewFilters();
    });

    const employeeSelect = document.getElementById('employeeViewFilter');
    if (employeeSelect) employeeSelect.addEventListener('change', e => {
        activeEmployeeFilter = e.target.value;
        applyViewFilters();
    });

    const dateFromFilter = document.getElementById('dateFromFilter');
    if (dateFromFilter) dateFromFilter.addEventListener('change', e => {
        activeDateFrom = e.target.value;
        applyViewFilters();
    });
    if (dateFromFilter && dateFromFilter.showPicker) {
        dateFromFilter.addEventListener('focus', () => dateFromFilter.showPicker());
    }

    const dateToFilter = document.getElementById('dateToFilter');
    if (dateToFilter) dateToFilter.addEventListener('change', e => {
        activeDateTo = e.target.value;
        applyViewFilters();
    });
    if (dateToFilter && dateToFilter.showPicker) {
        dateToFilter.addEventListener('focus', () => dateToFilter.showPicker());
    }

    document.getElementById('clearViewFilters').addEventListener('click', () => {
        resetViewFilters();
        document.getElementById('searchInput').value = '';
        applyViewFilters();
    });

    document.getElementById('downloadCsvBtn').addEventListener('click', downloadFilteredCsv);
}

function downloadFilteredCsv() {
    const config = tableConfig[currentDB][currentTable];
    const columns = getRenderColumns(config);
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
        columns.map(escapeCsv).join(','),
        ...filteredData.map(item => columns.map(col => escapeCsv(item[col])).join(','))
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kwikkwash-${currentTable}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getRenderColumns(config) {
    if (currentTable === 'bookings') {
        return ['booking_id', 'phone', 'city', 'service_code', 'booking_date', 'slot', 'total_amount', 'payment_status', 'status'];
    }
    if (currentTable === 'employees') {
        return ['employee_code', 'employee_name', 'phone', 'city', 'salary', 'active', 'skills'];
    }
    if (currentTable === 'jobs') {
        return ['id', 'employee_code', 'employee_name', 'employee_city', 'booking_id', 'status', 'service_code', 'job_address', 'created_at'];
    }
    if (currentTable === 'attendance') {
        return ['id', 'employee_code', 'employee_name', 'employee_city', 'attendance_date', 'in_time', 'out_time'];
    }
    if (currentTable === 'partner_services') {
        return ['id', 'partner_code', 'partner_name', 'city', 'service_code', 'units', 'price', 'coupon_code', 'coupon_count', 'active'];
    }
    return config.columns;
}

// ==================== LOAD DATA ====================
async function loadData() {
    const container = document.getElementById('tableContainer');
    const config = tableConfig[currentDB][currentTable];
    
    container.innerHTML = `<div class="loading-state">
        <div class="spinner"></div>
        <p>Loading ${config.name.toLowerCase()}...</p>
    </div>`;
    
    document.getElementById('searchInput').value = '';
    
    try {
        const response = await fetch(config.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        allTableData = await response.json();
        allTableData = await enrichDataForCurrentView(allTableData);
        resetViewFilters();
        filteredData = [...allTableData];
        document.body.classList.toggle('sidebar-compact', isDenseView());
        updateViewChrome();
        applyViewFilters();
    } catch (error) {
        showToast('error', `Failed to load data: ${error.message}`);
        container.innerHTML = `<div class="empty-state">
            <span style="font-size: 28px; font-weight: 700;">Load failed</span>
            <p>Unable to load data. Please try again.</p>
        </div>`;
    }
}

// ==================== SEARCH FUNCTION ====================
function handleSearch() {
    applyViewFilters();
}

// ==================== RENDER TABLE ====================
function renderFilteredTable() {
    const container = document.getElementById('tableContainer');
    const config = tableConfig[currentDB][currentTable];
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!filteredData || filteredData.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span style="font-size: 28px; font-weight: 700;">No results</span>
            <p>No matching records found</p>
        </div>`;
        return;
    }
    
    let html = '<table><thead><tr>';
    
    config.columns.forEach(col => {
        let label = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        if (currentTable === 'partner_services') {
            if (col === 'service_code') label = 'Service Name';
            if (col === 'units') label = 'Work units (10 mnts)';
            if (col === 'short_details') label = 'Service intro';
            if (col === 'long_details') label = 'Service full details';
            if (col === 'coupon_code') label = 'Coupon';
            if (col === 'coupon_count') label = 'Discount amount';
        }

        html += `<th>${label}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    filteredData.forEach(item => {
        html += '<tr>';
        config.columns.forEach(col => {
            let value = item[col];
            let displayValue = '';
            
            if (col === 'active') {
                displayValue = value === 1 ? 
                    '<span class="status-badge status-active">Active</span>' : 
                    '<span class="status-badge status-inactive">Inactive</span>';
            } else if (col.includes('price') || col === 'salary') {
                displayValue = value ? `Rs ${value.toLocaleString('en-IN')}` : '-';
            } else if (col === 'partner_code') {
                displayValue = value || '-';
            } else if (col === 'skills' && value) {
                const skillsList = value.split(',').map(s => s.trim()).join(', ');
                displayValue = skillsList;
            } else if (col === 'business_type') {
                displayValue = (value && typeof value === 'string')
                    ? value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                    : '-';
            } else if (col === 'background') {
                displayValue = (value && typeof value === 'string')
                    ? value.replace(/\b\w/g, l => l.toUpperCase())
                    : '-';
            } else if (col === 'attendance_date' && value) {
                displayValue = new Date(value).toLocaleDateString('en-IN');
            } else if ((col === 'in_time' || col === 'out_time') && value) {
                try {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        displayValue = date.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        });
                    } else {
                        displayValue = value.toString().slice(0, 5);
                    }
                } catch (e) {
                    displayValue = value.toString().slice(0, 5);
                }
            } else if (col === 'coupon_code') {
                displayValue = value || '-';
            } else if (col === 'long_details' && value) {
                displayValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
            } else if (col === 'units' && value) {
                displayValue = value + ' units';
            } else {
                displayValue = value !== null && value !== undefined ? value.toString() : '-';
            }
            
            if (searchTerm && displayValue.toLowerCase().includes(searchTerm)) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                displayValue = displayValue.replace(regex, '<span class="search-highlight">$1</span>');
            }
            
            html += `<td>${displayValue}</td>`;
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderFilteredTableV2() {
    const container = document.getElementById('tableContainer');
    const config = tableConfig[currentDB][currentTable];
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

    if (!filteredData || filteredData.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span style="font-size: 28px; font-weight: 700;">No results</span>
            <p>No matching records found</p>
        </div>`;
        return;
    }

    const columns = getRenderColumns(config);
    const labels = columns.map(col => {
        let label = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (col === 'employee_city') label = 'City';
        if (col === 'partner_name') label = 'Partner';
        if (col === 'total_amount') label = 'Amount';
        if (currentTable === 'partner_services' && col === 'service_code') label = 'Service';
        return label;
    });

    const formatValue = (item, col) => {
        const value = item[col];
        if (col === 'active') {
            return value == 1
                ? '<span class="status-badge status-active">Active</span>'
                : '<span class="status-badge status-inactive">Inactive</span>';
        }
        if (col === 'status' || col === 'payment_status') {
            const status = value ? String(value).toLowerCase() : 'pending';
            return `<span class="status-badge status-${status}">${status.replace(/_/g, ' ')}</span>`;
        }
        if (col.includes('price') || col === 'salary' || col === 'total_amount' || col === 'amount') {
            const amount = Number(value || 0);
            return amount ? `Rs ${amount.toLocaleString('en-IN')}` : '-';
        }
        if ((col === 'attendance_date' || col === 'booking_date') && value) {
            return String(value).slice(0, 10);
        }
        if ((col === 'created_at' || col === 'assigned_at' || col === 'duty_in_time') && value) {
            return String(value).slice(0, 16).replace('T', ' ');
        }
        if ((col === 'in_time' || col === 'out_time') && value) {
            return String(value).slice(0, 16).replace('T', ' ');
        }
        if (col === 'units' && value) {
            return `${value} units`;
        }
        if (value === null || value === undefined || value === '') return '-';
        const text = String(value);
        return text.length > 48 ? `${text.slice(0, 48)}...` : text;
    };

    let html = '<table class="compact-data-table"><thead><tr>';
    labels.forEach(label => {
        html += `<th>${label}</th>`;
    });
    html += '</tr></thead><tbody>';

    filteredData.forEach(item => {
        html += '<tr>';
        columns.forEach((col, index) => {
            const rawValue = item[col];
            let displayValue = formatValue(item, col);
            if (searchTerm && String(displayValue).toLowerCase().includes(searchTerm)) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                displayValue = String(displayValue).replace(regex, '<span class="search-highlight">$1</span>');
            }
            html += `<td data-label="${labels[index]}" title="${String(rawValue ?? '').replace(/"/g, '&quot;')}">${displayValue}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ==================== UPDATE SUMMARY ====================
function updateSummary(data) {
    const primaryLabel = document.getElementById('primaryMetricLabel');
    const secondaryLabel = document.getElementById('secondaryMetricLabel');
    const setDefaultMetricLabels = () => {
        if (currentTable === 'attendance') {
            primaryLabel.textContent = 'Checked In';
            secondaryLabel.textContent = 'Missing Out';
        } else if (['bookings', 'jobs'].includes(currentTable)) {
            primaryLabel.textContent = 'Open';
            secondaryLabel.textContent = 'Closed';
        } else {
            primaryLabel.textContent = 'Active';
            secondaryLabel.textContent = 'Inactive';
        }
    };

    if (!data || data.length === 0) {
        document.getElementById('totalCount').textContent = '0';
        document.getElementById('activeCount').textContent = '0';
        document.getElementById('inactiveCount').textContent = '0';
        setDefaultMetricLabels();
        return;
    }
    
    const total = data.length;
    let primary = 0;
    let secondary = 0;

    if (data.some(item => item.status !== undefined)) {
        const closedStatuses = ['completed', 'done', 'cancelled', 'canceled', 'failed'];
        primaryLabel.textContent = 'Open';
        secondaryLabel.textContent = 'Closed';
        secondary = data.filter(item => closedStatuses.includes(getStatusValue(item))).length;
        primary = total - secondary;
    } else if (currentTable === 'attendance') {
        primaryLabel.textContent = 'Checked In';
        secondaryLabel.textContent = 'Missing Out';
        primary = data.filter(item => item.in_time).length;
        secondary = data.filter(item => !item.out_time).length;
    } else {
        primaryLabel.textContent = 'Active';
        secondaryLabel.textContent = 'Inactive';
        primary = data.filter(item => item.active == 1).length;
        secondary = total - primary;
    }
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('activeCount').textContent = primary;
    document.getElementById('inactiveCount').textContent = secondary;
    document.getElementById('recordCount').textContent = `${total} records`;
}

// ==================== OPEN ADD MODAL ====================
async function openAddModal() {
    if (READ_ONLY) {
        showToast('info', `${BRANCH_CITY} partner access is read-only`);
        return;
    }

    editId = null;
    editItemData = null;
    
    const config = tableConfig[currentDB][currentTable];
    document.getElementById('modalTitle').textContent = `Add New ${config.name}`;
    
    document.getElementById('modalForm').innerHTML = `<div class="loading-state">
        <div class="spinner"></div>
        <p>Loading form...</p>
    </div>`;
    document.getElementById('modal').style.display = 'block';
    
    const dropdowns = await config.getDropdowns();
    document.getElementById('modalForm').innerHTML = config.addForm(dropdowns);
}

// ==================== OPEN EDIT MODAL ====================
async function openEditModal(item) {
    if (READ_ONLY) {
        showToast('info', `${BRANCH_CITY} partner access is read-only`);
        return;
    }

    editItemData = item;
    editId = item[tableConfig[currentDB][currentTable].idField];
    
    const config = tableConfig[currentDB][currentTable];
    document.getElementById('modalTitle').textContent = `Edit ${config.name}`;
    
    document.getElementById('modalForm').innerHTML = `<div class="loading-state">
        <div class="spinner"></div>
        <p>Loading form...</p>
    </div>`;
    document.getElementById('modal').style.display = 'block';
    
    const dropdowns = await config.getDropdowns();
    document.getElementById('modalForm').innerHTML = config.addForm(dropdowns);
    
    setTimeout(async () => {
        const idField = document.getElementById('id');
        if (idField) {
            idField.value = item.id;
        }
        
        for (const key of Object.keys(item)) {
            const field = document.getElementById(key);
            if (field) {
                if (key === 'skills') {
                    field.value = item[key] || '';
                } else {
                    field.value = item[key];
                }
            }
        }
        
        const partnerField = document.getElementById('partner_code');
        if (partnerField && partnerField.value) {
            await updateSkillsByPartner(partnerField.value);
        }
    }, 200);
}

// ==================== SAVE ITEM ====================
async function saveItem() {
    if (READ_ONLY) {
        showToast('error', 'Changes are disabled for partner access');
        return;
    }

    const config = tableConfig[currentDB][currentTable];
    const form = document.getElementById('modalForm');
    const inputs = form.querySelectorAll('input, select, textarea');
    const data = {};
    let isValid = true;
    
    inputs.forEach(input => {
        if (input.id === 'skills') {
            data[input.id] = input.value;
        } else {
            if (input.hasAttribute('required') && !input.value.trim()) {
                input.style.borderColor = '#ff6b6b';
                isValid = false;
            } else {
                input.style.borderColor = '';
            }
            
            if (input.id) {
                if (input.type === 'number') {
                    data[input.id] = input.value === '' ? null : parseFloat(input.value);
                } else {
                    data[input.id] = input.value;
                }
            }
        }
    });
    
    if (!isValid) {
        showToast('error', 'Please fill all required fields');
        return;
    }
    
    if (editId && config.idField === 'employee_code') {
        data.employee_code = editId;
    } 
    else if (editId && config.idType === 'single') {
        data.id = editId;   // FORCE ID (important)
    }
    
    try {
        const response = await fetch(config.addEndpoint, {
            method: editId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            result = {
                status: 'error',
                message: response.ok
                    ? 'Operation failed'
                    : `Request failed (HTTP ${response.status})`
            };
        }

        if (result.status === 'success') {
            showToast('success', `Record ${editId ? 'updated' : 'added'} successfully`);
            closeModal();
            loadData();
        } else {
            showToast('error', result.message || `Operation failed${response.ok ? '' : ` (HTTP ${response.status})`}`);
        }
    } catch (error) {
        showToast('error', `Error: ${error.message}`);
    }
}

// ==================== DELETE FUNCTIONS ====================

function openDeleteModal(item) {
    if (READ_ONLY) {
        showToast('info', `${BRANCH_CITY} partner access is read-only`);
        return;
    }

    deleteItemData = item;
    
    const config = tableConfig[currentDB][currentTable];
    let itemName = '';
    
    // Get a meaningful name to display
    if (item.franchise_name) itemName = item.franchise_name;
    else if (item.employee_name) itemName = item.employee_name;
    else if (item.service_name) itemName = item.service_name;
    else if (item.service_code) itemName = item.service_code;
    else if (item.partner_code) itemName = item.partner_code;
    else if (item.employee_code) itemName = item.employee_code;
    else itemName = `ID: ${item.id || 'Unknown'}`;
    
    document.getElementById('deleteItemName').textContent = itemName;
    document.getElementById('deleteModal').style.display = 'block';
}

function closeDeleteModal() {
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) deleteModal.style.display = 'none';
    deleteItemData = null;
}

async function confirmDelete() {
    if (READ_ONLY) {
        showToast('error', 'Delete is disabled for partner access');
        return;
    }

    if (!deleteItemData) return;
    
    const config = tableConfig[currentDB][currentTable];
    let url = '';
    
    try {
        if (currentTable === 'attendance') {
            if (!deleteItemData.employee_code || !deleteItemData.attendance_date) {
                showToast('error', 'Missing employee code or attendance date');
                closeDeleteModal();
                return;
            }
            url = config.deleteUrl(deleteItemData);
        } else {
            const id = deleteItemData[config.idField];
            if (!id) {
                showToast('error', 'Missing ID field');
                closeDeleteModal();
                return;
            }
            url = config.deleteUrl(id);
        }
        
        const response = await fetch(url, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.status === 'success') {
            showToast('success', 'Record deleted successfully');
            closeDeleteModal();
            loadData();
        } else {
            showToast('error', result.message || 'Delete failed');
            closeDeleteModal();
        }
    } catch (error) {
        showToast('error', `Error: ${error.message}`);
        closeDeleteModal();
    }
}

// (deleteItem function removed - now using openDeleteModal)

// ==================== TOAST ====================
function showToast(type, message) {
    const toast = document.getElementById('toast');
    const id = Date.now();
    
    toast.innerHTML += `
        <div class="toast ${type}" data-id="${id}">
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        </div>
    `;
    
    setTimeout(() => {
        const toastEl = document.querySelector(`[data-id="${id}"]`);
        if (toastEl) toastEl.remove();
    }, 5000);
}

// ==================== CLOSE MODAL ====================
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
    editId = null;
    editItemData = null;
}
// bahar click pe popup band karne k lie 
//window.onclick = (e) => {
  //  const modal = document.getElementById('modal');
    //const deleteModal = document.getElementById('deleteModal');
    
   // if (e.target === modal) closeModal();
    //if (e.target === deleteModal) closeDeleteModal();
//};
