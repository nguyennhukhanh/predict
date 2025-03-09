// Chart utility to correctly display indicators
class TradingChart {
  constructor(elementId) {
    this.element = document.getElementById(elementId);
    this.chart = null;
  }

  renderChart(prediction) {
    if (this.chart) {
      this.chart.destroy();
    }
    
    this.element.innerHTML = '';
    
    const currentPrice = prediction.currentPrice;
    const targetPrice = prediction.prediction.targetPrice;
    const stopLoss = prediction.prediction.stopLoss;
    const direction = prediction.prediction.direction;
    
    // Generate historical data - in a real app this would come from the API
    const historicalData = this._generateHistoricalData(prediction);
    const futureData = this._generateFutureProjection(prediction);
    
    const options = {
      series: [
        {
          name: 'Historical Price',
          data: historicalData
        },
        {
          name: 'Projection',
          data: futureData
        }
      ],
      chart: {
        height: 250,
        type: 'line',
        toolbar: {
          show: false,
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
        },
        background: 'transparent'
      },
      stroke: {
        width: [2, 2],
        curve: 'smooth',
        dashArray: [0, 5]
      },
      colors: ['#eaecef', direction === 'long' ? '#26a69a' : '#ef5350'],
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: '#787b86',
          },
          datetimeFormatter: {
            hour: 'HH:mm',
          }
        },
        axisBorder: {
          show: false,
        },
        axisTicks: {
          show: false,
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#787b86',
          },
          formatter: function (val) {
            return '$' + val.toFixed(2);
          }
        }
      },
      grid: {
        borderColor: '#2c3139',
        strokeDashArray: 4,
        xaxis: {
          lines: {
            show: false
          }
        }
      },
      tooltip: {
        theme: 'dark',
        x: {
          format: 'HH:mm'
        }
      },
      markers: {
        size: [0, 0]
      },
      annotations: {
        yaxis: [
          {
            y: currentPrice,
            borderColor: '#f0b90b',
            label: {
              text: 'Entry',
              style: {
                color: '#1e2329',
                background: '#f0b90b'
              }
            }
          },
          {
            y: targetPrice,
            borderColor: '#26a69a',
            label: {
              text: 'Target',
              style: {
                color: '#1e2329',
                background: '#26a69a'
              }
            }
          },
          {
            y: stopLoss,
            borderColor: '#ef5350',
            label: {
              text: 'Stop',
              style: {
                color: '#1e2329',
                background: '#ef5350'
              }
            }
          }
        ]
      }
    };

    this.chart = new ApexCharts(this.element, options);
    this.chart.render();
  }

  _generateHistoricalData(prediction) {
    const data = [];
    const timeNow = new Date(prediction.timestamp);
    const timeframe = prediction.timeframe;
    
    // Generate points based on timeframe
    let timeStep = 60 * 60 * 1000; // 1h default in milliseconds
    
    switch(timeframe) {
      case '1m': timeStep = 1 * 60 * 1000; break;
      case '5m': timeStep = 5 * 60 * 1000; break;
      case '15m': timeStep = 15 * 60 * 1000; break;
      case '30m': timeStep = 30 * 60 * 1000; break;
      case '1h': timeStep = 60 * 60 * 1000; break;
      case '4h': timeStep = 4 * 60 * 60 * 1000; break;
      case '1d': timeStep = 24 * 60 * 60 * 1000; break;
    }
    
    for (let i = 14; i >= 0; i--) {
      const time = new Date(timeNow.getTime() - (i * timeStep));
      
      // Add some random noise to create a realistic looking chart
      const noise = (Math.random() - 0.5) * (prediction.currentPrice * 0.02);
      const price = prediction.currentPrice + noise * (i / 7);
      
      data.push({
        x: time.getTime(),
        y: price
      });
    }
    
    // Add current price
    data.push({
      x: timeNow.getTime(),
      y: prediction.currentPrice
    });
    
    return data;
  }

  _generateFutureProjection(prediction) {
    const data = [];
    const timeNow = new Date(prediction.timestamp);
    const timeframe = prediction.timeframe;
    
    // Generate points based on timeframe
    let timeStep = 60 * 60 * 1000; // 1h default in milliseconds
    
    switch(timeframe) {
      case '15m': timeStep = 15 * 60 * 1000; break;
      case '30m': timeStep = 30 * 60 * 1000; break;
      case '1h': timeStep = 60 * 60 * 1000; break;
      case '4h': timeStep = 4 * 60 * 60 * 1000; break;
      case '1d': timeStep = 24 * 60 * 60 * 1000; break;
    }
    
    // Start point
    data.push({
      x: timeNow.getTime(),
      y: prediction.currentPrice
    });
    
    // Target point (approximately 7 time periods ahead)
    const targetTime = timeNow.getTime() + (7 * timeStep);
    data.push({
      x: targetTime,
      y: prediction.prediction.targetPrice
    });
    
    return data;
  }
}

// Technical indicators handler
class TechnicalIndicatorHandler {
  constructor(tableId) {
    this.table = document.getElementById(tableId);
  }
  
  updateIndicators(prediction) {
    this.table.innerHTML = '';
    const currentPrice = prediction.currentPrice;
    
    prediction.prediction.indicators.forEach(indicator => {
      const row = document.createElement('tr');
      row.className = 'border-t border-[#2c3139]';
      
      const nameCell = document.createElement('td');
      nameCell.className = 'py-2 text-sm';
      nameCell.textContent = indicator.name;
      
      const valueCell = document.createElement('td');
      valueCell.className = 'py-2 text-sm font-medium';
      
      // Handle array values (like multiple MACD values)
      if (Array.isArray(indicator.value)) {
        valueCell.textContent = indicator.value.map(v => v.toFixed(2)).join(', ');
      } else if (!isNaN(indicator.value)) {
        valueCell.textContent = parseFloat(indicator.value).toFixed(2);
      } else {
        valueCell.textContent = 'N/A';
      }
      
      if (indicator.color) {
        valueCell.style.color = indicator.color;
      }
      
      const signalCell = document.createElement('td');
      signalCell.className = 'py-2 text-sm';
      
      // Signal logic based on indicator type
      if (indicator.name === 'RSI') {
        if (indicator.value > 70) {
          signalCell.textContent = 'Overbought';
          signalCell.style.color = '#ef5350';
        } else if (indicator.value < 30) {
          signalCell.textContent = 'Oversold';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Neutral';
        }
      } else if (indicator.name === 'MACD') {
        if (indicator.value > 0) {
          signalCell.textContent = 'Bullish';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Bearish';
          signalCell.style.color = '#ef5350';
        }
      } else if (indicator.name.startsWith('EMA')) {
        if (currentPrice > indicator.value) {
          signalCell.textContent = 'Bullish';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Bearish';
          signalCell.style.color = '#ef5350';
        }
      } else if (indicator.name === 'StochRSI K') {
        if (indicator.value > 80) {
          signalCell.textContent = 'Overbought';
          signalCell.style.color = '#ef5350';
        } else if (indicator.value < 20) {
          signalCell.textContent = 'Oversold';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Neutral';
        }
      } else if (indicator.name === 'Percent B') {
        if (indicator.value > 0.8) {
          signalCell.textContent = 'Overbought';
          signalCell.style.color = '#ef5350';
        } else if (indicator.value < 0.2) {
          signalCell.textContent = 'Oversold';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Neutral';
        }
      } else {
        signalCell.textContent = '-';
      }
      
      row.appendChild(nameCell);
      row.appendChild(valueCell);
      row.appendChild(signalCell);
      
      this.table.appendChild(row);
    });
  }
}

// Initialize components when document is ready
document.addEventListener('DOMContentLoaded', function() {
  const tradingChart = new TradingChart('prediction-chart');
  const indicatorHandler = new TechnicalIndicatorHandler('indicators-table');
  
  window.renderChart = function(prediction) {
    tradingChart.renderChart(prediction);
  };
  
  window.updateIndicators = function(prediction) {
    indicatorHandler.updateIndicators(prediction);
  };

  // Form handling
  const form = document.getElementById('prediction-form');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    generateSignal();
  });
  
  // Check server status
  checkServerStatus();
  
  // Populate strategy dropdown
  fetchStrategies();
});

async function checkServerStatus() {
  const statusElement = document.getElementById('server-status');
  try {
    const response = await fetch('/api/strategies');
    if (response.ok) {
      statusElement.innerText = 'Server: Connected';
      statusElement.classList.add('text-[#26a69a]');
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    statusElement.innerText = 'Server: Disconnected';
    statusElement.classList.add('text-[#ef5350]');
  }
}

async function fetchStrategies() {
  try {
    const response = await fetch('/api/strategies');
    const strategies = await response.json();
    
    const strategySelect = document.getElementById('strategy');
    strategySelect.innerHTML = '';
    
    strategies.forEach(strategy => {
      const option = document.createElement('option');
      option.value = strategy.id;
      option.textContent = strategy.name;
      strategySelect.appendChild(option);
    });
    
    // Update timeframe options based on the selected strategy
    updateTimeframeOptions();
    
    strategySelect.addEventListener('change', updateTimeframeOptions);
    
  } catch (error) {
    console.error('Error fetching strategies:', error);
  }
}

function updateTimeframeOptions() {
  const strategySelect = document.getElementById('strategy');
  const timeframeSelect = document.getElementById('timeframe');
  
  // You would fetch this from your API in a real app
  const strategyTimeframes = {
    'trend-following': ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
    'mean-reversion': ['1m', '5m', '15m', '30m', '1h', '4h'],
    'ml-enhanced': ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
  };
  
  const selectedStrategy = strategySelect.value;
  const timeframes = strategyTimeframes[selectedStrategy] || ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
  
  const currentTimeframe = timeframeSelect.value;
  timeframeSelect.innerHTML = '';
  
  const timeframeLabels = {
    '1m': '1 Minute',
    '5m': '5 Minutes',
    '15m': '15 Minutes',
    '30m': '30 Minutes',
    '1h': '1 Hour',
    '4h': '4 Hours',
    '1d': '1 Day'
  };
  
  timeframes.forEach(tf => {
    const option = document.createElement('option');
    option.value = tf;
    option.textContent = timeframeLabels[tf] || tf;
    option.selected = tf === currentTimeframe;
    timeframeSelect.appendChild(option);
  });
}

async function generateSignal() {
  const symbol = document.getElementById('symbol').value.trim().toUpperCase();
  const timeframe = document.getElementById('timeframe').value;
  const strategy = document.getElementById('strategy').value;
  
  if (!symbol) {
    alert('Please enter a valid symbol');
    return;
  }
  
  // Show loading indicator
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('results-section').classList.add('hidden');
  
  try {
    const response = await fetch(`/api/predict?symbol=${symbol}&timeframe=${timeframe}&strategy=${strategy}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate signal');
    }
    
    const prediction = await response.json();
    displayResults(prediction);
    
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error('Error generating signal:', error);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function displayResults(prediction) {
  const results = document.getElementById('results-section');
  results.classList.remove('hidden');
  
  // Update basic info
  document.getElementById('result-symbol').textContent = prediction.symbol;
  document.getElementById('result-timeframe').textContent = prediction.timeframe;
  document.getElementById('result-time').textContent = `Updated: ${new Date(prediction.timestamp).toLocaleTimeString()}`;
  document.getElementById('result-price').textContent = `$${prediction.currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  
  // Update direction badge
  const directionBadge = document.getElementById('result-direction-badge');
  directionBadge.textContent = prediction.prediction.direction.toUpperCase();
  directionBadge.className = 'inline-block px-2 py-1 text-xs font-medium rounded';
  
  if (prediction.prediction.direction === 'long') {
    directionBadge.classList.add('badge-long');
  } else if (prediction.prediction.direction === 'short') {
    directionBadge.classList.add('badge-short');
  } else {
    directionBadge.classList.add('badge-neutral');
  }
  
  // Update confidence
  const confidencePercent = Math.round(prediction.prediction.confidence * 100);
  document.getElementById('confidence-value').textContent = `${confidencePercent}%`;
  document.getElementById('confidence-bar').style.width = `${confidencePercent}%`;
  
  // Update price targets
  document.getElementById('entry-price').textContent = `$${prediction.currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('entry-direction').textContent = prediction.prediction.direction.charAt(0).toUpperCase() + prediction.prediction.direction.slice(1);
  document.getElementById('target-price').textContent = `$${prediction.prediction.targetPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  document.getElementById('stop-loss').textContent = `$${prediction.prediction.stopLoss.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  
  // Calculate risk/reward
  const entryPrice = prediction.currentPrice;
  const targetPrice = prediction.prediction.targetPrice;
  const stopLoss = prediction.prediction.stopLoss;
  
  let riskPercent, rewardPercent;
  
  if (prediction.prediction.direction === 'long') {
    riskPercent = Math.abs((stopLoss - entryPrice) / entryPrice * 100);
    rewardPercent = Math.abs((targetPrice - entryPrice) / entryPrice * 100);
  } else if (prediction.prediction.direction === 'short') {
    riskPercent = Math.abs((entryPrice - stopLoss) / entryPrice * 100);
    rewardPercent = Math.abs((entryPrice - targetPrice) / entryPrice * 100);
  } else {
    riskPercent = 0;
    rewardPercent = 0;
  }
  
  const totalPercent = riskPercent + rewardPercent;
  const riskWidth = totalPercent > 0 ? (riskPercent / totalPercent) * 100 : 50;
  const rewardWidth = totalPercent > 0 ? (rewardPercent / totalPercent) * 100 : 50;
  
  document.getElementById('risk-bar').style.width = `${riskWidth}%`;
  document.getElementById('reward-bar').style.width = `${rewardWidth}%`;
  document.getElementById('risk-value').textContent = `${riskPercent.toFixed(2)}%`;
  document.getElementById('reward-value').textContent = `${rewardPercent.toFixed(2)}%`;
  
  // Historical accuracy if available
  if (prediction.historicalAccuracy) {
    const accuracyPercent = Math.round(prediction.historicalAccuracy * 100);
    document.getElementById('historical-accuracy').textContent = `${accuracyPercent}%`;
  } else {
    document.getElementById('historical-accuracy').textContent = 'N/A';
  }
  
  // Update indicators table using our handler
  if (window.updateIndicators) {
    window.updateIndicators(prediction);
  } else {
    // Fallback to basic implementation
    const indicatorsTable = document.getElementById('indicators-table');
    indicatorsTable.innerHTML = '';
    
    prediction.prediction.indicators.forEach(indicator => {
      const row = document.createElement('tr');
      row.className = 'border-t border-[#2c3139]';
      
      const nameCell = document.createElement('td');
      nameCell.className = 'py-2 text-sm';
      nameCell.textContent = indicator.name;
      
      const valueCell = document.createElement('td');
      valueCell.className = 'py-2 text-sm font-medium';
      
      // Handle array values and NaN values
      if (Array.isArray(indicator.value)) {
        valueCell.textContent = indicator.value.map(v => 
          !isNaN(v) ? v.toFixed(2) : 'N/A'
        ).join(', ');
      } else if (!isNaN(indicator.value)) {
        valueCell.textContent = parseFloat(indicator.value).toFixed(2);
      } else {
        valueCell.textContent = 'N/A';
      }
      
      if (indicator.color) {
        valueCell.style.color = indicator.color;
      }
      
      const signalCell = document.createElement('td');
      signalCell.className = 'py-2 text-sm';
      
      // Enhanced signal logic
      if (indicator.name === 'RSI') {
        if (indicator.value > 70) {
          signalCell.textContent = 'Overbought';
          signalCell.style.color = '#ef5350';
        } else if (indicator.value < 30) {
          signalCell.textContent = 'Oversold';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Neutral';
        }
      } else if (indicator.name === 'MACD') {
        if (indicator.value > 0) {
          signalCell.textContent = 'Bullish';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Bearish';
          signalCell.style.color = '#ef5350';
        }
      } else if (indicator.name.startsWith('EMA')) {
        if (isNaN(indicator.value)) {
          signalCell.textContent = 'Insufficient data';
          signalCell.style.color = '#787b86';
        } else if (prediction.currentPrice > indicator.value) {
          signalCell.textContent = 'Bullish';
          signalCell.style.color = '#26a69a';
        } else {
          signalCell.textContent = 'Bearish';
          signalCell.style.color = '#ef5350';
        }
      } else {
        signalCell.textContent = '-';
      }
      
      row.appendChild(nameCell);
      row.appendChild(valueCell);
      row.appendChild(signalCell);
      
      indicatorsTable.appendChild(row);
    });
  }
  
  // Render chart using our chart utility
  if (window.renderChart) {
    window.renderChart(prediction);
  } else {
    // Use basic chart renderer as fallback
    renderBasicChart(prediction);
  }
}

// Fallback chart renderer in case our advanced one fails
function renderBasicChart(prediction) {
  const chartElement = document.getElementById('prediction-chart');
  chartElement.innerHTML = '';
  
  const currentPrice = prediction.currentPrice;
  const targetPrice = prediction.prediction.targetPrice;
  const stopLoss = prediction.prediction.stopLoss;
  const direction = prediction.prediction.direction;
  
  // Generate some historical data for demonstration
  const historicalData = [];
  const timeNow = new Date(prediction.timestamp);
  const timeframe = prediction.timeframe;
  
  // Generate time steps based on timeframe
  let timeStep = 60 * 60 * 1000; // 1h default in milliseconds
  switch(timeframe) {
    case '1m': timeStep = 1 * 60 * 1000; break;
    case '5m': timeStep = 5 * 60 * 1000; break;
    case '15m': timeStep = 15 * 60 * 1000; break;
    case '30m': timeStep = 30 * 60 * 1000; break;
    case '1h': timeStep = 60 * 60 * 1000; break;
    case '4h': timeStep = 4 * 60 * 60 * 1000; break;
    case '1d': timeStep = 24 * 60 * 60 * 1000; break;
  }
  
  for (let i = 14; i >= 0; i--) {
    const time = new Date(timeNow.getTime() - (i * timeStep));
    
    // Add some random noise to create a realistic looking chart
    const noise = (Math.random() - 0.5) * (currentPrice * 0.02);
    const price = currentPrice + noise * (i / 7);
    
    historicalData.push({
      x: time.getTime(),
      y: price
    });
  }
  
  // Add current price
  historicalData.push({
    x: timeNow.getTime(),
    y: currentPrice
  });
  
  // Generate future price projection
  const futureData = [];
  futureData.push({
    x: timeNow.getTime(),
    y: currentPrice
  });
  
  // Add target point (approximately 7 time periods ahead)
  const targetTime = timeNow.getTime() + (7 * timeStep);
  futureData.push({
    x: targetTime,
    y: targetPrice
  });
  
  // Chart options
  const options = {
    series: [
      {
        name: 'Historical Price',
        data: historicalData
      },
      {
        name: 'Projection',
        data: futureData
      }
    ],
    chart: {
      height: 250,
      type: 'line',
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
      background: 'transparent'
    },
    stroke: {
      width: [2, 2],
      curve: 'smooth',
      dashArray: [0, 5]
    },
    colors: ['#eaecef', direction === 'long' ? '#26a69a' : '#ef5350'],
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: '#787b86',
        },
        datetimeFormatter: {
          hour: 'HH:mm',
        }
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#787b86',
        },
        formatter: function (val) {
          return '$' + val.toFixed(2);
        }
      }
    },
    grid: {
      borderColor: '#2c3139',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false
        }
      }
    },
    tooltip: {
      theme: 'dark',
      x: {
        format: 'HH:mm'
      }
    },
    markers: {
      size: [0, 0]
    },
    annotations: {
      yaxis: [
        {
          y: currentPrice,
          borderColor: '#f0b90b',
          label: {
            text: 'Entry',
            style: {
              color: '#1e2329',
              background: '#f0b90b'
            }
          }
        },
        {
          y: targetPrice,
          borderColor: '#26a69a',
          label: {
            text: 'Target',
            style: {
              color: '#1e2329',
              background: '#26a69a'
            }
          }
        },
        {
          y: stopLoss,
          borderColor: '#ef5350',
          label: {
            text: 'Stop',
            style: {
              color: '#1e2329',
              background: '#ef5350'
            }
          }
        }
      ]
    }
  };
  
  const chart = new ApexCharts(chartElement, options);
  chart.render();
}
