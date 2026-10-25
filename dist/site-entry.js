// Route before loading any asset-owned datasets or model state.
const requested = new URLSearchParams(location.search).get('symbol')?.toUpperCase();
const symbol = ['ETHUSD','MSTR','BMNR'].includes(requested) ? requested : 'BTCUSD';
document.documentElement.dataset.symbol = symbol;
const bootSymbol = document.querySelector('.atlas-boot-symbol');
if (bootSymbol) bootSymbol.textContent = symbol;
try {
  if (symbol === 'ETHUSD') {
    const { initEthView } = await import("./eth-view.js?v=1.23.0");
    await initEthView();
  } else if (symbol === 'MSTR' || symbol === 'BMNR') {
    const { initEquityView } = await import("./equity-view.js?v=1.23.0");
    await initEquityView({symbol});
  } else {
    await import("./app.js?v=1.25.0");
  }
} catch (error) {
  console.error('Chart initialization failed', error);
  document.dispatchEvent(new CustomEvent('atlas:boot-error'));
}
