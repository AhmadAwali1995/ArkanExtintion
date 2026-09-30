const PAGE_URL =
  "https://arkkanapp2.net/Arkan/frm8157_Students.aspx?scrid=8157&menutitle=4403&website=1";

const FIELD = {
  nationalId: "ctl00$Student_id_fltr$txtIdentityNo",
  referenceId: "ctl00$Student_id_fltr$Txt_ref",
  confirmButton: "ctl00$Student_id_fltr$btnConfirm",
};

const LABELS = {
  name: "الاسم",
  mobile: "رقم الجوال",
  idType: "نوع الهوية",
  gender: "النوع",
  nationality: "الجنسية",
  nationalId: "رقم الهوية",
  referenceId: "الرقم المرجعي",
};

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function collectFormParams(doc) {
  const params = new URLSearchParams();

  for (const el of doc.querySelectorAll("input, select, textarea")) {
    const name = el.getAttribute("name");
    if (!name) continue;

    const type = (el.getAttribute("type") || el.tagName).toLowerCase();
    if (["submit", "button", "image", "file"].includes(type)) continue;

    if (type === "checkbox" || type === "radio") {
      if (el.checked) params.append(name, el.value || "on");
      continue;
    }

    if (el.tagName === "SELECT") {
      const selected = Array.from(el.selectedOptions || []);
      if (selected.length) {
        for (const opt of selected) params.append(name, opt.value);
      } else {
        params.set(name, el.value || "");
      }
      continue;
    }

    params.set(name, el.value || "");
  }

  return params;
}

function valueNearLabel(doc, labelText) {
  const nodes = Array.from(doc.querySelectorAll("label, span, td, th, div, p, strong, b"));

  for (const el of nodes) {
    const text = normalizeText(el.textContent);
    if (text !== labelText && !text.startsWith(`${labelText} `) && !text.startsWith(`${labelText}:`)) {
      continue;
    }

    if (el.tagName === "LABEL" && el.htmlFor) {
      const linked = doc.getElementById(el.htmlFor);
      if (linked) {
        const linkedValue = normalizeText(linked.value || linked.textContent);
        if (linkedValue && linkedValue !== labelText) return linkedValue;
      }
    }

    const inSelf = el.querySelector("input, textarea, select, span, td");
    if (inSelf) {
      const selfValue = normalizeText(inSelf.value || inSelf.textContent);
      if (selfValue && selfValue !== labelText) return selfValue;
    }

    const parent = el.parentElement;
    if (parent) {
      const siblingInput = parent.querySelector("input, textarea, select");
      if (siblingInput) {
        const parentValue = normalizeText(siblingInput.value || siblingInput.textContent);
        if (parentValue && parentValue !== labelText) return parentValue;
      }
    }

    let sibling = el.nextElementSibling;
    while (sibling) {
      if (sibling.matches("input, textarea, select")) {
        const value = normalizeText(sibling.value || sibling.textContent);
        if (value) return value;
      }
      const nested = sibling.querySelector("input, textarea, select");
      if (nested) {
        const value = normalizeText(nested.value || nested.textContent);
        if (value) return value;
      }
      const textValue = normalizeText(sibling.textContent);
      if (textValue && textValue !== labelText) return textValue;
      sibling = sibling.nextElementSibling;
    }
  }

  return "";
}

function parseMedicalExams(doc) {
  const exams = [];
  const tables = Array.from(doc.querySelectorAll("table"));

  for (const table of tables) {
    const headerText = normalizeText(table.textContent).slice(0, 200);
    if (!headerText.includes("الفحوصات") && !headerText.includes("المستوصف")) continue;

    const rows = Array.from(table.querySelectorAll("tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("th, td")).map((cell) =>
        normalizeText(cell.textContent)
      );
      if (cells.length < 3) continue;
      if (cells.some((cell) => cell.includes("المستوصف") || cell.includes("تاريخ الفحص"))) continue;
      if (cells.every((cell) => !cell)) continue;

      exams.push({
        clinic: cells[0] || "",
        result: cells[1] || "",
        examDateGregorian: cells[2] || "",
        examDateHijri: cells[3] || "",
        expiryDateGregorian: cells[4] || "",
        expiryDateHijri: cells[5] || "",
        rawCells: cells,
      });
    }
  }

  return exams;
}

function parseTraineeJson(html, requested) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const nationalId =
    doc.getElementById("ctl00_Student_id_fltr_txtIdentityNo")?.value ||
    valueNearLabel(doc, LABELS.nationalId) ||
    requested.nationalId;

  const referenceId =
    doc.getElementById("ctl00_Student_id_fltr_Txt_ref")?.value ||
    valueNearLabel(doc, LABELS.referenceId) ||
    requested.referenceId;

  return {
    nationalId,
    referenceId,
    name: valueNearLabel(doc, LABELS.name),
    mobile: valueNearLabel(doc, LABELS.mobile),
    idType: valueNearLabel(doc, LABELS.idType),
    gender: valueNearLabel(doc, LABELS.gender),
    nationality: valueNearLabel(doc, LABELS.nationality),
    medicalExams: parseMedicalExams(doc),
  };
}

async function fetchInquiry(nationalId, referenceId) {
  const getResponse = await fetch(PAGE_URL, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!getResponse.ok) {
    throw new Error(`فشل تحميل الصفحة (${getResponse.status})`);
  }

  const getHtml = await getResponse.text();
  if (getHtml.includes("login") && getHtml.length < 5000) {
    // soft signal only; continue — many apps embed the word elsewhere
  }

  const getDoc = new DOMParser().parseFromString(getHtml, "text/html");
  const params = collectFormParams(getDoc);
  params.set(FIELD.nationalId, nationalId);
  params.set(FIELD.referenceId, referenceId);
  params.set(FIELD.confirmButton, "استعلام");

  const postResponse = await fetch(PAGE_URL, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: params.toString(),
  });

  if (!postResponse.ok) {
    throw new Error(`فشل الاستعلام (${postResponse.status})`);
  }

  const postHtml = await postResponse.text();
  return parseTraineeJson(postHtml, { nationalId, referenceId });
}
