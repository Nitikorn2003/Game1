import { describe, expect, it } from 'vitest';
import { listingProblems, privacyPage } from '../../../tools/store-assets.js';
import { CATALOG } from '../src/catalog.js';
import { LOCALES } from '../src/i18n/index.js';
import { PRIVACY_POLICY } from '../src/privacy.js';
import { listing } from '../store/listing.js';
import config from '../store/store.js';

describe('the Google Play listing', () => {
  it.each(LOCALES)('fits Play Console in %s', (locale) => {
    expect(listingProblems(listing(locale))).toEqual([]);
  });

  it.each(LOCALES)('names every in-app product in %s', (locale) => {
    const products = listing(locale).products;
    expect(products.map((p) => p.id)).toEqual(CATALOG.map((item) => item.id));
    for (const product of products) expect(product.name, product.id).not.toBe(product.id);
  });

  it('catches what Play Console would refuse', () => {
    const ok = listing('en');
    expect(listingProblems({ ...ok, title: 'Lodelings: The Best Free Idle Game' })).toEqual([
      'title has 34 characters, over 30',
      '"Best" in "Lodelings: The Best Free Idle Game"',
    ]);
    expect(listingProblems({ ...ok, shortDescription: '' })).toEqual(['short description is empty']);
  });
});

describe('the privacy policy', () => {
  it('has the same sections in every language', () => {
    const ids = (locale: (typeof LOCALES)[number]) => PRIVACY_POLICY[locale].map((section) => section.id);
    for (const locale of LOCALES) expect(ids(locale)).toEqual(ids('en'));
  });

  it('is published as one page in every listing language, as plain text', () => {
    const page = privacyPage({ ...config, privacy: (locale) => ({ ...config.privacy(locale), sections: [{ id: 'x', heading: 'A <b>', body: 'x & "y"' }] }) });
    for (const locale of LOCALES) expect(page).toContain(`<article id="${locale}" lang="${locale}">`);
    expect(page).toContain('<section id="th-x"><h2>A &lt;b&gt;</h2><p>x &amp; &quot;y&quot;</p></section>');
    // Play Console's account deletion link points here.
    expect(privacyPage(config)).toContain('<section id="en-deleting">');
  });
});

