// Instrument routing happens before the BTC application is imported. ETH never
// initializes the Bitcoin dataset, research workbench or forecast engines.
const symbol = new URLSearchParams(location.search).get('symbol')?.toUpperCase() === 'ETHUSD' ? 'ETHUSD' : 'BTCUSD';
document.documentElement.dataset.symbol = symbol;
const bootSymbol = document.querySelector('.atlas-boot-symbol');
if (bootSymbol) bootSymbol.textContent = symbol;
try {
  if (symbol === 'ETHUSD') {
    const { initEthView } = await import('./eth-view.js?v=1.17.0-context.1');
    await initEthView();
  } else {
    await import('./app.js?v=1.15.0-eth.1');
  }
} catch (error) {
  console.error('Chart initialization failed', error);
  document.dispatchEvent(new CustomEvent('atlas:boot-error'));
}
