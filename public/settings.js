const settingsButtons = document.querySelectorAll('.settings-container button');
const settingsPages = document.querySelectorAll('.settings-page');

// Function to handle showing a specific tab and its content
function showTab(button, page) {
  // Remove 'active' class from all buttons and pages
  settingsButtons.forEach(btn => btn.classList.remove('active'));
  settingsPages.forEach(p => p.classList.remove('active'));
  
  // Add 'active' class to the clicked button and its corresponding content
  button.classList.add('active');
  page.classList.add('active');
}

// Show the 'Account' tab by default on page load
const defaultButton = document.querySelector('[data-target-id="account-content"]');
const defaultPage = document.getElementById('account-content');

if (defaultButton && defaultPage) {
  showTab(defaultButton, defaultPage);
}

// Add click listeners to all buttons
settingsButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.targetId;
    const targetPage = document.getElementById(targetId);
    if (targetPage) {
      showTab(button, targetPage);
    }
  });
});