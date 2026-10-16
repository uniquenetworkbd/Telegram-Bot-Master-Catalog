(() => {
  'use strict';
  const keys = {theme:'tbmc-theme',density:'tbmc-density',motion:'tbmc-motion'};
  const $ = id => document.getElementById(id);
  function read(key, fallback){try{return localStorage.getItem(key)||fallback}catch(_){return fallback}}
  function apply(){
    const theme=$('themeSelect').value,density=$('densitySelect').value,motion=$('motionSelect').value;
    if(theme==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',theme);
    if(density==='comfortable')document.documentElement.removeAttribute('data-density');else document.documentElement.setAttribute('data-density',density);
    if(motion==='system')document.documentElement.removeAttribute('data-motion');else document.documentElement.setAttribute('data-motion',motion);
  }
  function load(){ $('themeSelect').value=read(keys.theme,'system');$('densitySelect').value=read(keys.density,'comfortable');$('motionSelect').value=read(keys.motion,'system');apply();$('settingsStatus').textContent='Saved preferences loaded from this device.'; }
  $('saveSettings').addEventListener('click',()=>{try{Object.entries(keys).forEach(([id,key])=>localStorage.setItem(key,$(id+'Select').value));apply();$('settingsStatus').textContent='Preferences saved and applied.';}catch(_){apply();$('settingsStatus').textContent='Applied for this page; browser storage is unavailable.';}});
  $('resetSettings').addEventListener('click',()=>{try{Object.values(keys).forEach(key=>localStorage.removeItem(key));}catch(_){}load();$('settingsStatus').textContent='Reset to device/browser defaults.';});
  ['themeSelect','densitySelect','motionSelect'].forEach(id=>$(id).addEventListener('change',apply));
  load();
})();