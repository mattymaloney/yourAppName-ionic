angular.module('yourAppsName.services', [])

.factory('encodeURIService', function () {
  return {
    encode: function (string) {
      return encodeURIComponent(string).replace(/\"/g, "%22").replace(/\ /g, "%20").replace(/[!'()]/g, escape);
    }
  };
})

.factory('dateService', function ($filter) {
  var currentDate = function () {
    var d = new Date();
    var date = $filter('date')(d, 'yyyy-MM-dd');
    return date;
  };

  var oneYearAgoDate = function () {
    var d = new Date(new Date().setDate(new Date().getDate() - 365));
    var date = $filter('date')(d, 'yyyy-MM-dd');
    return date;
  };

  return {
    currentDate: currentDate,
    oneYearAgoDate: oneYearAgoDate
  }
})

.factory('stockDataCacheService', function (CacheFactory) {

  var stockDataCache;

  if (!CacheFactory.get('stockDataCache')) {
    stockDataCache = CacheFactory('stockDataCache', {
      maxAge: 60 * 1000,
      deleteOnExpire: 'aggressive',
      storageMode: 'localStorage'
    });
  }
  else {
    stockDataCache = CacheFactory.get('stockDataCache');
  }

  return stockDataCache;
})

.factory('stockPriceCacheService', function (CacheFactory) {

  var stockDataCache;

  if (!CacheFactory.get('stockPriceCache')) {
    stockPriceCache = CacheFactory('stockPriceCache', {
      maxAge: 60 * 1000,
      deleteOnExpire: 'aggressive',
      storageMode: 'localStorage'
    });
  }
  else {
    stockPriceCache = CacheFactory.get('stockPriceCache');
  }

  return stockPriceCache;
})

.factory('stockDataService', function ($q, $http, encodeURIService, stockDataCacheService, stockPriceCacheService) {

  /*
  http://query1.finance.yahoo.com/v7/finance/quote?symbols=GOOG,HSBA.L
  https://www.financial-hacker.com/bye-yahoo-and-thank-you-for-the-fish/

  Chart Images:
  https://stooq.com/c/?s=aapl.us&c=1y&t=c&a=ln
  https://stooq.com/c/?s=aapl.us&c=5y
  */

  var getDetailsData = function (ticker) {
    var deferred = $q.defer()
      //, url = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=" + ticker + "&apikey=N5VMD9R6RYRKHLJH"
      , url = "https://api.iextrading.com/1.0/stock/" + ticker + "/company"
      //, url = "https://api.iextrading.com/1.0/stock/" + ticker + "/quote"
      , cacheKey = ticker
      , stockDataCache = stockDataCacheService.get(cacheKey)
      ;

    if (stockDataCache) {
      console.log('found stock data cache', stockDataCache);
      deferred.resolve(stockDataCache);
    } 
    else {
      $http.get(url)
        .success(function (json) {
          // console.log(json)
          var jsonData = json;
          deferred.resolve(jsonData);
          stockDataCacheService.put(cacheKey, jsonData);
        })
        .error(function (error) {
          console.log("Details data error", error);
          deferred.reject();
        });
    }

    return deferred.promise;
  };

  var getPriceData = function (ticker) {
    var deferred = $q.defer()
      //, url = "https://api.intrinio.com/prices?identifier=" + ticker + "&api_key=Ojc0YmNhN2JiYTgwN2MwYzJiNDYyYThiZTI0M2Q0ZDhj"
      , url = "https://api.iextrading.com/1.0/stock/" + ticker + "/quote"
      , cacheKey = ticker
      , stockPriceCache = stockPriceCacheService.get(cacheKey)
      ;

    if (stockPriceCache) {
      console.log('found stock price cache', stockPriceCache);
      deferred.resolve(stockPriceCache);
    }
    else {
      $http.get(url)
        .success(function (json) {
          // console.log(json);
          // var jsonData = json;
          json.marketCapK = Math.round(json.marketCap / 1000).toLocaleString();
          json.marketCapM = Math.round(json.marketCap / 1000000).toLocaleString();
          json.marketCapB = Math.round(json.marketCap / 1000000000).toLocaleString();
          deferred.resolve(json);
          stockPriceCacheService.put(cacheKey, json);
        })
        .error(function (error) {
          console.log("Price data error", error);
          deferred.reject();
        });
    }

    return deferred.promise;
  };
  
  return {
    getPriceData: getPriceData,
    getDetailsData: getDetailsData
  };

})

.factory('chartDataCacheService', function (CacheFactory) {
  var chartDataCache;

  if (!CacheFactory.get('chartDataCache')) {
    chartDataCache = CacheFactory('chartDataCache', {
      maxAge: 60 * 60 * 8 * 1000,
      deleteOnExpire: 'aggressive',
      storageMode: 'localStorage'
    });
  }
  else {
    chartDataCache = CacheFactory.get('chartDataCache');
  }

  return chartDataCache;
})

.factory('chartDataService', function ($q, $http, encodeURIService, chartDataCacheService) {

  var getHistoricalData = function (ticker, fromDate, toDate) {
    var deferred = $q.defer()
      , url = 'https://api.intrinio.com/prices?identifier=' + ticker + '&start_date=' + fromDate + '&end_date=' + toDate + '&page_size=2000&api_key=Ojc0YmNhN2JiYTgwN2MwYzJiNDYyYThiZTI0M2Q0ZDhj'
      // , url = 'https://api.intrinio.com/prices?identifier=' + ticker + '&start_date=' + fromDate + '&page_size=2000&api_key=Ojc0YmNhN2JiYTgwN2MwYzJiNDYyYThiZTI0M2Q0ZDhj'
      , cacheKey = ticker
      , chartDataCache = chartDataCacheService.get(cacheKey)
      ;

    // console.log("historical data url", url);

    if (chartDataCache) {
      console.log('found cache chart data', chartDataCache);
      deferred.resolve(chartDataCache);
    }
    else {
      $http.get(url)
        .success(function (json) {
          var jsonData = json.data
            , priceData = []
            , volumeData = []
            ;

          jsonData.forEach(function (dayData) {
            var dateInMillis = Date.parse(dayData.date)
              , price = parseFloat(Math.round(dayData.close * 1000) / 1000).toFixed(3)
              , volume = dayData.volume
              // , priceDatum = '[' + dateInMillis + ',' + price + ']'
              // , volumeDatum = '[' + dateInMillis + ',' + volume + ']'
              ;
            
            // volumeData.unshift(volumeDatum);
            // priceData.unshift(priceDatum);
            priceData.unshift([dateInMillis, price]);
            volumeData.unshift([dateInMillis, volume]);
          });

          var chartData = [{
            key: 'volume',
            bar: true,
            values: volumeData
          },{
            key: ticker,
            values: priceData
          }];

          console.log(volumeData, priceData, chartData);

          deferred.resolve(chartData);
          chartDataCacheService.put(cacheKey, chartData);
        })
        .error(function (error) {
          console.log('Chart data error', error);
          deferred.reject();
        });
    }

    return deferred.promise;
  };

  return {
    getHistoricalData: getHistoricalData
  };

})

.factory('notesCacheService', function (CacheFactory) {
  var notesCache;

  if (!CacheFactory.get('notesCache')) {
    notesCache = CacheFactory('notesCache', {
      storageMode: 'localStorage'
    });
  }
  else {
    notesCache = CacheFactory.get('notesCache');
  }

  return notesCache;
})

.factory('notesService', function (notesCacheService) {

  return {
    getNotes: function (ticker) {
      return notesCacheService.get(ticker);
    },
    addNote: function (ticker, note) {
      var stockNotes = [];
      if (notesCacheService.get(ticker)) {
        stockNotes = notesCacheService.get(ticker);
        stockNotes.push(note);
      }
      else {
        stockNotes.push(note);
      }
      notesCacheService.put(ticker, stockNotes);
    },
    deleteNote: function (ticker, index) {
      var stockNotes = [];
      stockNotes = notesCacheService.get(ticker);
      stockNotes.splice(index, 1);
      notesCacheService.put(ticker, stockNotes);
    }
  };
});

;
