// Static inquiry values (not taken from the page UI).
const STATIC_NATIONAL_ID = "2485772384";
const STATIC_REFERENCE_ID = "68803896";

/** JSON result loaded inside the extension (popup). */
let traineeData = null;

const nationalIdView = document.getElementById("nationalIdView");
const referenceIdView = document.getElementById("referenceIdView");
const inquireBtn = document.getElementById("inquireBtn");
const statusEl = document.getElementById("status");
const jsonOut = document.getElementById("jsonOut");

nationalIdView.textContent = STATIC_NATIONAL_ID;
referenceIdView.textContent = STATIC_REFERENCE_ID;

function setStatus(message, type) {
  statusEl.hidden = !message;
  statusEl.textContent = message || "";
  statusEl.className = `status${type ? ` ${type}` : ""}`;
}

function showJson(data) {
  traineeData = data;
  jsonOut.hidden = false;
  jsonOut.textContent = JSON.stringify(data, null, 2);
}

inquireBtn.addEventListener("click", async () => {
  inquireBtn.disabled = true;
  jsonOut.hidden = true;
  setStatus("جارٍ الاستعلام...", "");

  try {
    const data = await fetchInquiry(STATIC_NATIONAL_ID, STATIC_REFERENCE_ID);
    showJson(data);

    if (!data.name && !data.mobile) {
      setStatus(
        "تم الطلب لكن لم تُستخرج بيانات كافية — تأكد أنك مسجّل دخول في arkkanapp2.net",
        "error"
      );
    } else {
      setStatus("تم تحميل البيانات في JSON", "ok");
    }
  } catch (error) {
    traineeData = null;
    setStatus(error?.message || "حدث خطأ أثناء الاستعلام", "error");
  } finally {
    inquireBtn.disabled = false;
  }
});
