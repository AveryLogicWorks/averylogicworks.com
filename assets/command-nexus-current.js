(function () {
  'use strict';
  if (!/command-nexus\.html$/i.test(window.location.pathname)) return;

  function text(el, value) { if (el) el.textContent = value; }
  function hideStageHistory() {
    document.querySelectorAll('[data-cn-stage]').forEach(function (block) {
      block.hidden = block.getAttribute('data-cn-stage') !== 'full';
    });

    document.querySelectorAll('#pricing p, #pricing .sub-note').forEach(function (p) {
      var t = (p.textContent || '').toLowerCase();
      if ((t.includes('alpha') && t.includes('beta')) || t.includes('moves from alpha') || t.includes('grows in stages')) {
        p.hidden = true;
      }
    });
  }

  function normalizeEvaluation() {
    var full = document.querySelector('[data-cn-stage="full"]');
    if (full) {
      var panel = full.querySelector('.trial-panel');
      if (panel) {
        text(panel.querySelector('.section-label'), '15-Day Extended Evaluation');
        text(panel.querySelector('.muted'), 'Optional extended evaluation access for 15 days. A free Avery Logic Works account is required. This is separate from the standard 3-day free trial.');
        var button = panel.querySelector('[data-cn-link="trialFull"]');
        if (button) button.textContent = 'Start 15-day extended evaluation — $10';
      }
    }

    var cards = document.querySelectorAll('.price-simple-card');
    if (cards.length) {
      var first = cards[0];
      text(first.querySelector('.ps-name'), 'Extended Evaluation');
      text(first.querySelector('.ps-price'), '$10');
      text(first.querySelector('.ps-note'), '15 days, full access');
    }

    var note = document.querySelector('#pricing .price-note');
    if (note) note.textContent = 'Every plan requires an Avery Logic Works account. Start with the free 3-day trial, choose an optional 15-day extended evaluation, or select a recurring plan.';
  }

  function normalizeReleaseCopy() {
    document.querySelectorAll('p,div,span').forEach(function (node) {
      if (node.children && node.children.length) return;
      var value = (node.textContent || '').trim();
      if (value === 'Command Nexus is a new early-access Windows app. Because it is newly released and not yet recognized as a signed publisher, Windows Defender SmartScreen may show an “Unknown publisher” warning.') {
        node.textContent = 'Command Nexus is independently distributed and the current Windows release is not yet publisher-signed. Windows Defender SmartScreen may therefore show an “Unknown publisher” reputation notice.';
      }
      if (value === 'I am working on publisher signing and trust improvements as the release grows.') {
        node.textContent = 'Publisher signing and Windows reputation improvements are in progress.';
      }
    });

    var downloadPageLink = document.querySelector('#ft-state-done a[href="download.html"]');
    if (downloadPageLink) {
      downloadPageLink.href = 'software-subscriptions.html';
      downloadPageLink.textContent = 'Software subscriptions';
    }
  }

  function run() {
    hideStageHistory();
    normalizeEvaluation();
    normalizeReleaseCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.setTimeout(run, 400);
})();
