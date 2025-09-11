document.addEventListener("DOMContentLoaded", () => {

  const settingsButtons = document.querySelectorAll('.settings-container button');
  const settingsPages = document.querySelectorAll('.settings-page');

  function showTab(button, page) {
    settingsButtons.forEach(btn => btn.classList.remove('active'));
    settingsPages.forEach(p => p.classList.remove('active'));
    button.classList.add('active');
    page.classList.add('active');
  }

  const defaultButton = document.querySelector('[data-target-id="account-content"]');
  const defaultPage = document.getElementById('account-content');

  if (defaultButton && defaultPage) {
    showTab(defaultButton, defaultPage);
  }

  settingsButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.targetId;
      const targetPage = document.getElementById(targetId);
      if (targetPage) showTab(button, targetPage);
    });
  });

  const bioInput = document.getElementById("bio-edit");
  const maxBioLength = 150;

  bioInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
  });

  const bioWrapper = document.createElement("div");
  bioWrapper.style.position = "relative";
  bioInput.parentNode.insertBefore(bioWrapper, bioInput);
  bioWrapper.appendChild(bioInput);

  const bioCounter = document.createElement("div");
  bioCounter.id = "bio-counter";
  bioCounter.style.cssText = `
    position: absolute;
    bottom: 4px;
    right: 6px;
    font-size: 12px;
    color: gray;
    pointer-events: none;
  `;
  bioWrapper.appendChild(bioCounter);

  function updateBioCounter() {

    bioInput.value = bioInput.value.replace(/\r?\n/g, '').substring(0, maxBioLength);
    bioCounter.textContent = `${bioInput.value.length}/${maxBioLength}`;
  }

  updateBioCounter();

  bioInput.addEventListener("input", updateBioCounter);
});