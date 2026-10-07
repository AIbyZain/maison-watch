/* ==========================================================================
   Section 4 · Private Viewing
   Front-end only form. On submit, opens WhatsApp with every field filled in.
   ========================================================================== */
import { site, whatsappLink } from '../data/site.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function buildViewing(section) {
  const { viewing, products } = site;
  section.classList.add('section-pad');
  section.innerHTML = `
    <div class="viewing__grid">
      <div class="viewing__lead">
        <h2 class="viewing__line serif" id="viewing-title">${esc(viewing.line)}</h2>
        <p class="viewing__note">${esc(viewing.note)}</p>
        <button class="btn btn--solid" type="button" data-start-booking>Book a Private Viewing</button>
      </div>

      <form class="form" novalidate aria-label="Private viewing request">
        <div class="field">
          <label class="field__label label" for="f-name">Name</label>
          <input class="field__input" id="f-name" name="name" type="text" autocomplete="name"
                 required aria-describedby="f-name-err" />
          <p class="field__error" id="f-name-err"></p>
        </div>

        <div class="field">
          <label class="field__label label" for="f-phone">Phone</label>
          <input class="field__input" id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"
                 placeholder="+92 300 000 0000" required aria-describedby="f-phone-err" />
          <p class="field__error" id="f-phone-err"></p>
        </div>

        <div class="field">
          <label class="field__label label" for="f-watch">Preferred watch</label>
          <select class="field__input" id="f-watch" name="watch" aria-describedby="f-watch-err">
            <option value="">No preference yet</option>
            ${products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
          <p class="field__error" id="f-watch-err"></p>
        </div>

        <div class="field">
          <label class="field__label label" for="f-date">Preferred date <small>(optional)</small></label>
          <input class="field__input" id="f-date" name="date" type="date" min="${todayISO()}"
                 aria-describedby="f-date-err" />
          <p class="field__error" id="f-date-err"></p>
        </div>

        <div class="field field--full">
          <label class="field__label label" for="f-msg">Message <small>(optional)</small></label>
          <textarea class="field__input" id="f-msg" name="message" rows="3"
                    placeholder="Wrist size, a strap you would like to try, a time that suits you."
                    aria-describedby="f-msg-err"></textarea>
          <p class="field__error" id="f-msg-err"></p>
        </div>

        <div class="form__foot">
          <button class="btn" type="submit">Send request on WhatsApp</button>
          <p class="form__status" role="status" aria-live="polite"></p>
        </div>
      </form>
    </div>`;
}

export function initViewing(section, { scrollToTarget }) {
  const form = section.querySelector('.form');
  const status = section.querySelector('.form__status');
  const fields = {
    name: form.elements.name,
    phone: form.elements.phone,
    watch: form.elements.watch,
    date: form.elements.date,
    message: form.elements.message,
  };
  let attempted = false;

  const rules = {
    name: (v) => (v.trim().length < 2 ? 'Please enter your name.' : ''),
    phone: (v) => {
      const digits = v.replace(/\D/g, '');
      if (!v.trim()) return 'Please enter a phone number so we can confirm.';
      if (!/^[+\d][\d\s()-]*$/.test(v.trim()) || digits.length < 7 || digits.length > 15)
        return 'Enter a valid phone number, for example +92 300 123 4567.';
      return '';
    },
    watch: () => '',
    date: (v) => (v && v < todayISO() ? 'Choose today or a later date.' : ''),
    message: (v) => (v.length > 600 ? 'Please keep the message under 600 characters.' : ''),
  };

  function check(name) {
    const input = fields[name];
    const msg = rules[name](input.value);
    const field = input.closest('.field');
    field.classList.toggle('is-invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    field.querySelector('.field__error').textContent = msg;
    return !msg;
  }

  Object.keys(fields).forEach((name) => {
    fields[name].addEventListener('input', () => attempted && check(name));
    fields[name].addEventListener('blur', () => attempted && check(name));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    attempted = true;
    const results = Object.keys(fields).map((n) => [n, check(n)]);
    const firstBad = results.find(([, ok]) => !ok);
    if (firstBad) {
      fields[firstBad[0]].focus();
      status.textContent = 'Please check the highlighted fields.';
      return;
    }

    const product = site.products.find((p) => p.id === fields.watch.value);
    const date = fields.date.value
      ? new Date(`${fields.date.value}T12:00:00`).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Flexible';
    const lines = [
      `Hello ${site.name}, I would like to book a private viewing.`,
      '',
      `Name: ${fields.name.value.trim()}`,
      `Phone: ${fields.phone.value.trim()}`,
      `Watch: ${product ? `${product.name} (Ref. ${product.ref})` : 'No preference yet'}`,
      `Preferred date: ${date}`,
    ];
    if (fields.message.value.trim()) lines.push(`Message: ${fields.message.value.trim()}`);

    // No 'noopener' feature string here: it makes window.open return null,
    // which would hide a real pop-up block. The opener is cut manually instead.
    const win = window.open(whatsappLink(lines.join('\n')), '_blank');
    if (win) win.opener = null;
    status.textContent = win === null
      ? 'Your browser blocked the new tab. Allow pop-ups for this site, then send again.'
      : 'WhatsApp opened in a new tab with your request. Press send there to finish.';
  });

  // "Book a Private Viewing" button: bring the form into view and start typing.
  section.querySelector('[data-start-booking]').addEventListener('click', () => {
    scrollToTarget(form);
    form.classList.add('is-highlight');
    setTimeout(() => {
      fields.name.focus({ preventScroll: true });
      form.classList.remove('is-highlight');
    }, 900);
  });

  // Pre-select a watch when coming from the collection overlay.
  document.addEventListener('maison:select-watch', (e) => {
    fields.watch.value = e.detail.id;
    setTimeout(() => fields.name.focus({ preventScroll: true }), 1400);
  });
}
