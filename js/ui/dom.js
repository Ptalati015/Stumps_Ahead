// Tiny DOM builder. Strings become text nodes, so names and commentary are
// never parsed as HTML (SPEC section 8.8). No innerHTML anywhere in the UI.

/**
 * el('button', { className: 'btn', onClick: fn, disabled: true }, 'Play')
 * Props: className, onClick, dataset {}, style {} (CSS custom properties
 * allowed), boolean/DOM properties (disabled, type, ...), aria-* / role /
 * other attributes as strings.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'onClick') node.addEventListener('click', value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') {
      for (const [prop, v] of Object.entries(value)) node.style.setProperty(prop, v);
    } else if (key.startsWith('aria-') || key === 'role' || key === 'for') node.setAttribute(key, String(value));
    else node[key] = value;
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(node, child);
    else if (child instanceof Node) node.append(child);
    else node.append(document.createTextNode(String(child)));
  }
}

/** Sets --team-primary / --team-secondary on a node from a Team or nation. */
export function teamColors(team) {
  return { '--team-primary': team.colors.primary, '--team-secondary': team.colors.secondary };
}

/** A round colour badge with the nation code: no flags or crests. */
export function teamBadge(team, size = '') {
  return el('span', { className: `badge ${size ? `badge--${size}` : ''}`, style: teamColors(team), 'aria-hidden': 'true' }, team.code);
}

/** Wraps a handler so it runs at most once until `reset()` is called. */
export function once(fn) {
  let used = false;
  const wrapped = (...args) => {
    if (used) return;
    used = true;
    fn(...args);
  };
  wrapped.reset = () => { used = false; };
  return wrapped;
}
