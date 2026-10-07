var GROUP_LINK = "https://chat.whatsapp.com/D0uZQWQB3aTJaUXeS1Q4jm";
// Optional: paste a webhook URL (Google Apps Script, Zapier, Make, etc.) to receive each name and number.
var WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbweJOtnSvjuaL8PCHZkdJP34YYr1p91dKhFRO5k18WlwThGtJFTEnMQg-mEtU0ToLrP_w/exec";
var COUNTRY_CODES_API = "https://countriesnow.space/api/v0.1/countries/codes";

function detectUserRegionCode() {
  var locales = [];

  if (Array.isArray(navigator.languages)) locales = locales.concat(navigator.languages);
  if (navigator.language) locales.push(navigator.language);

  for (var i = 0; i < locales.length; i += 1) {
    var locale = String(locales[i] || '').trim();
    if (!locale) continue;

    if (typeof Intl !== 'undefined' && typeof Intl.Locale === 'function') {
      try {
        var intlLocale = new Intl.Locale(locale);
        if (intlLocale.region && intlLocale.region.length === 2) {
          return intlLocale.region.toUpperCase();
        }
      } catch (err) {}
    }

    var match = locale.match(/[-_]([A-Za-z]{2})(?:$|[-_])/);
    if (match) return match[1].toUpperCase();
  }

  return null;
}

function findPreferredOption(select, regionCode, fallbackCode) {
  if (regionCode) {
    var byRegion = select.querySelector('option[data-country-code="' + regionCode + '"]');
    if (byRegion) return byRegion;

    for (var i = 0; i < select.options.length; i += 1) {
      var optionText = String(select.options[i].textContent || '');
      var startsWithCode = optionText.indexOf(regionCode + ' ') === 0;
      var hasBracketCode = optionText.indexOf('(' + regionCode + ')') !== -1;
      if (startsWithCode || hasBracketCode) return select.options[i];
    }
  }

  return select.querySelector('option[value="' + fallbackCode + '"]') ||
    select.querySelector('option[value="+234"]') ||
    select.options[0];
}

function normalizeDialCode(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function buildCountryOption(country) {
  var code = (country.code || "").trim().toUpperCase();
  var dialCode = normalizeDialCode(country.dial_code);
  var name = (country.name || "").trim();

  if (!code || !dialCode) return null;

  var option = document.createElement('option');
  option.value = dialCode;
  option.textContent = name + " (" + code + ") " + dialCode;
  option.dataset.countryName = name;
  option.dataset.countryCode = code;
  return option;
}

function populateCountryCodes() {
  var select = document.getElementById('code');
  if (!select) return;

  var regionCode = 'NG';
  var fallbackCode = '+234';

  fetch(COUNTRY_CODES_API)
    .then(function (response) {
      if (!response.ok) throw new Error('Failed to load countries');
      return response.json();
    })
    .then(function (payload) {
      if (!payload || payload.error || !Array.isArray(payload.data)) return;

      var fragment = document.createDocumentFragment();
      var seen = new Set();

      payload.data
        .slice()
        .sort(function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .forEach(function (country) {
          var option = buildCountryOption(country);
          if (!option) return;

          var dedupeKey = option.textContent;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          fragment.appendChild(option);
        });

      if (!fragment.childNodes.length) return;

      select.innerHTML = '';
      select.appendChild(fragment);

      var preferred = findPreferredOption(select, regionCode, fallbackCode);

      if (preferred) {
        preferred.selected = true;
        select.value = preferred.value;
      }
    })
    .catch(function () {
      // Keep hardcoded options as fallback when API is unavailable.
      var preferred = findPreferredOption(select, regionCode, fallbackCode);
      if (preferred) {
        preferred.selected = true;
        select.value = preferred.value;
      }
    });
}

populateCountryCodes();

var form = document.getElementById('form');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('name').value.trim();
    var digits = document.getElementById('phone').value.replace(/\D/g, '').replace(/^0+/, '');
    var nameOk = name.length >= 2;
    var phoneOk = digits.length >= 7 && digits.length <= 12;

    document.getElementById('nameField').classList.toggle('invalid', !nameOk);
    document.getElementById('phoneField').classList.toggle('invalid', !phoneOk);
    if (!nameOk || !phoneOk) return;

    var btn = document.getElementById('btn');
    btn.disabled = true;
    document.getElementById('label').textContent = 'OPENING WHATSAPP...';

    if (WEBHOOK_URL) {
      try {
        fetch(WEBHOOK_URL, {
          method: 'POST', mode: 'no-cors', keepalive: true,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            name: name,
            phone: document.getElementById('code').value + digits,
            submittedAt: new Date().toISOString()
          }).toString()
        }).catch(function () {});
      } catch (err) {}
    }

    setTimeout(function () { window.location.href = GROUP_LINK; }, 400);
  });
}
