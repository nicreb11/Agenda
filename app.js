// GOOGLE SHEETS LIVE SYNC APP - Zero Local Storage Implementation

// ===== CONFIGURATION =====
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTN51uMp0WkNQlmqZe8_v0thpd5LwIxC2bfR3pouplZmelcbExlXqm_HotYKNNaBbEl9FS2N-94OTKz/pub?output=csv';

// ===== GLOBAL STATE (In-Memory Only) =====
let currentSchedule = {};
let unscheduledActivities = []; // NEW: Activities without date/time
let checkboxState = {}; // Store checkbox states locally
let isLoading = false;
let autoRefreshInterval = null;

// ===== LOGGING SYSTEM =====
function log(message) {
  const timestamp = new Date().toLocaleTimeString('it-IT');
  console.log(`[${timestamp}] ${message}`);
}

// ===== GOOGLE SHEETS DATA LOADING =====
async function loadDataFromGoogleSheets() {
  console.log('📥 Loading data from Google Sheets...');
  
  if (isLoading) {
    console.log('⏳ Already loading, skipping...');
    return;
  }
  
  isLoading = true;
  showLoadingIndicator();
  
  try {
    // Cache bust to ensure fresh data
    const response = await fetch(GOOGLE_SHEETS_CSV_URL + '&_=' + Date.now());
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    console.log('✅ CSV downloaded:', csvText.length, 'characters');
    
    // Parse CSV - now returns both schedule and unscheduled
    const parsed = parseCSVToSchedule(csvText);
    currentSchedule = parsed.schedule;
    unscheduledActivities = parsed.unscheduled;
    console.log('✅ Schedule parsed:', Object.keys(currentSchedule).length, 'dates');
    console.log('✅ Unscheduled activities:', unscheduledActivities.length);
    
    // Render app
    renderApp();
    hideLoadingIndicator();
    
    console.log('🎉 App loaded successfully');
    
  } catch (error) {
    console.error('❌ Failed to load from Google Sheets:', error);
    showErrorScreen(error.message);
  } finally {
    isLoading = false;
  }
}

function parseCSVToSchedule(csvText) {
  const lines = csvText.trim().split('\n');
  const schedule = {};
  const unscheduled = []; // Temporary array for unscheduled activities
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handle quoted fields)
    const parts = parseCSVLine(line);
    if (parts.length < 5) continue; // Need at least Data, Giorno, Ora, Emoji, Attività
    
    const date = parts[0].trim();
    const day = parts[1].trim();
    const time = parts[2].trim();
    const emoji = parts[3].trim();
    const activity = parts[4].trim();
    
    if (!activity) continue; // Activity is required
    
    // Check if this is an unscheduled activity (no date OR no time)
    const hasDate = date && date.length > 0;
    const hasTime = time && time.length > 0;
    
    const item = { 
      time: time || '—', // Use em-dash for no time
      emoji: emoji || '', 
      activity 
    };
    
    // Check for running details (columns 6-9)
    if (parts.length >= 9 && parts[5] && parts[5].trim()) {
      item.runningDetails = {
        tipo: parts[5].trim(),
        distanza: parts[6].trim(),
        ritmo: parts[7].trim(),
        note: parts[8].trim()
      };
    }
    
    // Separate scheduled vs unscheduled
    if (!hasDate || !hasTime) {
      // Unscheduled activity - will appear on today only
      unscheduled.push(item);
      console.log('📌 Unscheduled activity found:', activity);
    } else {
      // Normal scheduled activity
      if (!schedule[date]) {
        schedule[date] = [];
      }
      schedule[date].push(item);
    }
  }
  
  console.log(`✅ Parsed: ${Object.keys(schedule).length} dates, ${unscheduled.length} unscheduled activities`);
  
  return { schedule, unscheduled };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// ===== CHECKBOX STATE MANAGEMENT =====
// Note: Checkbox state is kept in memory during the session
// For persistent state across sessions, this would need server-side storage
function loadCheckboxState() {
  // Initialize empty checkbox state for this session
  checkboxState = {};
  console.log('✅ Checkbox state initialized for session');
}

function saveCheckboxState() {
  // State is automatically saved in the checkboxState variable
  console.log('💾 Checkbox state updated in memory');
}

// ===== APP INITIALIZATION =====
async function initApp() {
  console.log('🚀 App starting...');
  
  // Load checkbox state
  loadCheckboxState();
  
  // Load data immediately (no refresh button setup)
  await loadDataFromGoogleSheets();
  
  // Set up periodic refresh (every 5 minutes)
  autoRefreshInterval = setInterval(async () => {
    console.log('🔄 Auto-refreshing...');
    await loadDataFromGoogleSheets();
  }, 5 * 60 * 1000);
  
  console.log('✅ App initialized - drag & drop disabled, calendar emoji clickable');
}

// New function for calendar emoji click
async function refreshFromCalendarEmoji() {
  console.log('📅 Calendar emoji clicked - refreshing...');
  
  // Add visual feedback
  const calendarEmoji = document.querySelector('.calendar-emoji');
  if (calendarEmoji) {
    calendarEmoji.style.transform = 'scale(1.2)';
    calendarEmoji.style.transition = 'transform 0.2s';
    
    // Reset after animation
    setTimeout(() => {
      calendarEmoji.style.transform = 'scale(1)';
    }, 200);
  }
  
  // Trigger refresh
  await loadDataFromGoogleSheets();
}

function setupRefreshButton() {
  // DISABLED - refresh button functionality removed
  console.log('🚫 Refresh button disabled - use calendar emoji instead');
}

// ===== UI COMPONENTS =====
function showLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) {
    indicator.style.display = 'flex';
  }
}

function hideLoadingIndicator() {
  const indicator = document.getElementById('loading-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

function showErrorScreen(errorMessage) {
  const container = document.getElementById('app-container');
  container.innerHTML = `
    <div class="error-screen">
      <h2>❌ Errore di Caricamento</h2>
      <p>Impossibile caricare i dati da Google Sheets:</p>
      <code>${errorMessage}</code>
      <button class="retry-btn" onclick="location.reload()">
        🔄 Riprova
      </button>
      <p class="help-text">
        Verifica che il Google Sheet sia pubblico e accessibile.
      </p>
    </div>
  `;
}

function renderApp() {
  const container = document.getElementById('app-container');
  
  if (Object.keys(currentSchedule).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>📅 Nessun Programma</h2>
        <p>Il Google Sheet è vuoto o non contiene dati validi.</p>
        <p class="hint">Tocca l'emoji del calendario per ricaricare</p>
      </div>
    `;
    return;
  }
  
  // Render schedule (no drag and drop setup)
  renderSchedule();
  
  // DO NOT call setupDragAndDrop()
  console.log('✅ App rendered without drag & drop');
}

function renderSchedule() {
  const container = document.getElementById('app-container');
  
  // Get current date
  const today = new Date();
  const todayString = today.toLocaleDateString('it-IT');
  
  let html = `
    <div class="app-header">
      <h1 class="clickable-header" onclick="refreshFromCalendarEmoji()">
        <span class="calendar-emoji">📅</span> Routine Settimanale
      </h1>
    </div>
    <div class="schedule-container">
      <div class="days-container">
  `;
  
  // Filter and sort dates - ONLY show today and future dates
  const allDates = Object.keys(currentSchedule);
  const filteredDates = allDates.filter(date => {
    try {
      const dateObj = parseItalianDate(date);
      const todayObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return dateObj >= todayObj; // Only today and future
    } catch {
      return false; // Skip invalid dates
    }
  }).sort((a, b) => {
    // Sort dates chronologically
    try {
      const dateA = parseItalianDate(a);
      const dateB = parseItalianDate(b);
      return dateA - dateB;
    } catch {
      return a.localeCompare(b);
    }
  });
  
  if (filteredDates.length === 0) {
    html += `
        <div class="empty-state">
          <h2>📅 Nessun Programma Futuro</h2>
          <p>Non ci sono attività programmate da oggi in poi.</p>
          <p class="hint">Tocca l'emoji del calendario per aggiornare da Google Sheets</p>
        </div>
      </div>
    </div>
    <div class="app-footer">
      <p>📊 Dati sincronizzati da Google Sheets</p>
      <p class="last-update">Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}</p>
      <p class="hint">💡 Tocca l'emoji del calendario per aggiornare</p>
    </div>
  `;
    
    container.innerHTML = html;
    setupCheckboxListeners();
    return;
  }
  
  const sortedDates = filteredDates;
  
  sortedDates.forEach(date => {
    const scheduledActivities = currentSchedule[date] || [];
    const isToday = date === todayString;
    
    // For TODAY, prepend unscheduled activities
    let allActivitiesForThisDay = [];
    if (isToday && unscheduledActivities.length > 0) {
      allActivitiesForThisDay = [...unscheduledActivities, ...scheduledActivities];
    } else {
      allActivitiesForThisDay = scheduledActivities;
    }
    
    html += `
      <div class="day-card ${isToday ? 'today' : ''}">
        <h3 class="day-header">
          ${formatDateHeader(date)}
          ${isToday ? ' 📍' : ''}
        </h3>
        <div class="day-activities" data-date="${date}">
    `;
    
    allActivitiesForThisDay.forEach((activity, index) => {
      const checkboxId = `${date}_${index}`;
      const isChecked = checkboxState[checkboxId] || false;
      
      // Distinguish unscheduled activities visually
      const isUnscheduled = (isToday && index < unscheduledActivities.length);
      
      html += `
        <div class="activity-item ${isChecked ? 'checked' : ''} ${isUnscheduled ? 'unscheduled' : ''}" 
             data-date="${date}" 
             data-index="${index}"
             data-time="${activity.time}" 
             data-emoji="${activity.emoji || ''}"
             data-activity="${activity.activity}"
             ${activity.runningDetails ? `data-running-details='${JSON.stringify(activity.runningDetails)}'` : ''}>
          
          <input type="checkbox" 
                 class="activity-checkbox" 
                 id="${checkboxId}"
                 data-date="${date}"
                 data-index="${index}"
                 ${isChecked ? 'checked' : ''}>
          
          <div class="activity-content">
            <div class="activity-main">
              <span class="activity-time ${isUnscheduled ? 'no-time' : ''}">${activity.time}</span>
              ${activity.emoji ? `<span class="activity-emoji">${activity.emoji}</span>` : ''}
              <span class="activity-text">${activity.activity}</span>
            </div>
            
            ${activity.runningDetails ? renderRunningDetails(activity.runningDetails) : ''}
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
    <div class="app-footer">
      <p>📊 Dati sincronizzati da Google Sheets</p>
      <p class="last-update">Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}</p>
      <p class="hint">💡 Tocca l'emoji del calendario per aggiornare</p>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Setup checkbox listeners
  setupCheckboxListeners();
}

function setupCheckboxListeners() {
  document.querySelectorAll('.activity-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function(e) {
      const checkboxId = this.id;
      const isChecked = this.checked;
      const activityItem = this.closest('.activity-item');
      
      // Update state
      checkboxState[checkboxId] = isChecked;
      
      // Update visual state
      if (isChecked) {
        activityItem.classList.add('checked');
      } else {
        activityItem.classList.remove('checked');
      }
      
      // Save to memory
      saveCheckboxState();
      
      console.log(`☑️ Checkbox ${checkboxId}: ${isChecked}`);
    });
  });
}

function parseItalianDate(dateStr) {
  // Parse Italian date format (dd/mm/yyyy)
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-based in JS
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
  }
  throw new Error('Invalid date format');
}

function formatDateHeader(dateStr) {
  try {
    const date = parseItalianDate(dateStr);
    const dayName = date.toLocaleDateString('it-IT', { weekday: 'long' });
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dateStr}`;
  } catch {
    return dateStr;
  }
}

function renderRunningDetails(details) {
  return `
    <div class="running-details">
      <div class="detail-row">
        <div class="label">TIPO</div>
        <div class="value">${details.tipo}</div>
      </div>
      <div class="detail-row">
        <div class="label">DISTANZA/TEMPO</div>
        <div class="value">${details.distanza}</div>
      </div>
      <div class="detail-row">
        <div class="label">RITMO</div>
        <div class="value">${details.ritmo}</div>
      </div>
      <div class="detail-row">
        <div class="label">NOTE</div>
        <div class="value">${details.note}</div>
      </div>
    </div>
  `;
}

// ===== DRAG & DROP (Read-only, visual only) =====
function setupDragAndDrop() {
  // DISABLED - drag and drop functionality temporarily removed
  console.log('🚫 Drag & drop disabled');
  
  // Optional: Add comment in code for future reactivation
  /*
  document.querySelectorAll('.day-activities').forEach(container => {
    new Sortable(container, {
      animation: 150,
      delay: 500,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      handle: '.activity-content',
      
      onStart: function(evt) {
        console.log('🎯 Visual reorder started');
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      },
      
      onEnd: function(evt) {
        console.log('📍 Visual reorder ended');
        showTemporaryMessage('ℹ️ Riordino temporaneo - modifica il Google Sheet per salvare');
      }
    });
  });
  */
}

function showTemporaryMessage(message) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'temporary-message';
  msgDiv.textContent = message;
  msgDiv.style.animation = 'slideIn 0.3s ease-out';
  
  document.body.appendChild(msgDiv);
  
  setTimeout(() => {
    msgDiv.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => msgDiv.remove(), 300);
  }, 3000);
}

// ===== APP STARTUP =====
document.addEventListener('DOMContentLoaded', function() {
  log('📱 DOM loaded, starting Google Sheets app');
  initApp();
});

// Clean up interval on page unload
window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});

log('🎯 Google Sheets sync app script loaded');