const ACCESS_KEY = "cinemalab_market_access";
const DASHBOARD_PATH = "dashboard/";
const LOGIN = "root";
const PASSWORD = "sIlver@^";

function openDashboard() {
  window.location.assign(DASHBOARD_PATH);
}

try {
  if (sessionStorage.getItem(ACCESS_KEY) === "granted") openDashboard();
} catch (error) {
  // Session storage can be disabled; in that case the form will show an error.
}

const form = document.getElementById("login-form");
const error = document.getElementById("login-error");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = document.getElementById("login-user").value.trim();
  const password = document.getElementById("login-password").value;

  if (user === LOGIN && password === PASSWORD) {
    try {
      sessionStorage.setItem(ACCESS_KEY, "granted");
      openDashboard();
    } catch (storageError) {
      error.textContent = "Браузер заблокировал временный доступ. Разрешите sessionStorage и попробуйте ещё раз.";
    }
    return;
  }

  error.textContent = "Неверный логин или пароль.";
});
