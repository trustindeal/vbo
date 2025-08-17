// Tiny, client-side email capture to localStorage (you can wire this to a backend later)
document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('notify-form');
const email = document.getElementById('email');
const btn = document.getElementById('notify-btn');
const msg = document.getElementById('msg');

form.addEventListener('submit', () => {
  btn.disabled = true;
  const val = email.value.trim();
  if (!val) return;
  // For now, just save locally to show UX; replace with your endpoint later.
  const saved = JSON.parse(localStorage.getItem('early-birds') || '[]');
  if (!saved.includes(val)) saved.push(val);
  localStorage.setItem('early-birds', JSON.stringify(saved));
  msg.textContent = 'Thanks! We’ll let you know when we launch.';
  setTimeout(() => { btn.disabled = false; email.value = ''; }, 1200);
});
