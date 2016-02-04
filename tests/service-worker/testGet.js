var NETWORK_TIMEOUT = 1000;
var MORE_THAN_NETWORK_TIMEOUT = NETWORK_TIMEOUT + 100;

var $debug = false;
var $resources = [];
var $excludedPaths = [];
var $cacheName = 'testCache';
var $networkTimeout = NETWORK_TIMEOUT;

describe('get()', function() {
  'use strict';

  var clock;
  var fakeCache;

  beforeEach(function() {
    fakeCache = {
      put: sinon.stub().returns(Promise.resolve())
    };
    clock = sinon.useFakeTimers();
    importScripts('/base/wp-offline/lib/js/sw.js');
    sinon.stub(wpOffline, 'openCache').returns(Promise.resolve(fakeCache));
    sinon.stub(Response.prototype, 'clone').returnsThis();
  });

  afterEach(function() {
    clock.restore();
    Response.prototype.clone.restore();
  });

  function addByPassWhenNetwork(networkResponse) {
    describe('get() when network available but request is not a GET or url is excluded', function() {

      it('always fetches from network if excluded', function() {
        sinon.stub(wpOffline, 'isExcluded').returns(true);
        return wpOffline.get(new Request('/test/url'))
        .then(response => {
          wpOffline.isExcluded.restore();
          return response;
        })
        .then(response => {
          assert.strictEqual(response, networkResponse);
        });
      });

      it('always fetches from network if it is not a GET request', function() {
        var nonGetRequest = new Request('some/valid/url', { method: 'POST'});
        return wpOffline.get(nonGetRequest)
        .then(response => {
          assert.strictEqual(response, networkResponse);
        });
      });
    });
  }

  function addByPassWhenNoNetwork() {
    describe('get() when network not available and request is not a GET or url is excluded', function() {
      var networkError = {};

      before(function() {
        sinon.stub(self, 'fetch').returns(Promise.reject(networkError));
      });

      after(function() {
        self.fetch.restore();
      });

      it('error if excluded', function() {
        sinon.stub(wpOffline, 'isExcluded').returns(true);
        return wpOffline.get(new Request('/test/url'))
        .catch(error => {
          wpOffline.isExcluded.restore();
          return error;
        })
        .then(error => {
          assert.strictEqual(error, networkError);
        });
      });

      it('error if it is not a GET request', function() {
        var nonGetRequest = new Request('some/valid/url', { method: 'POST'});
        return wpOffline.get(nonGetRequest)
        .catch(error => {
          assert.strictEqual(error, networkError);
        });
      });
    });
  }

  // TODO: It remains to check clone(). This can bit us.
  describe('get() when network is available and it does not time out', function() {
    var networkResponse = new Response('success!');

    before(function() {
      sinon.stub(self, 'fetch').returns(Promise.resolve(networkResponse));
    });

    after(function() {
      self.fetch.restore();
    });

    addByPassWhenNetwork(networkResponse);

    it('fetches from network', function() {
      return wpOffline.get(new Request('test/url'))
        .then(response => {
          assert.strictEqual(response, networkResponse);
        });
    });

    it('stores a fresh copy in the cache', function() {
      var request = new Request('some/url');
      return wpOffline.get(request)
        .then(() => {
          assert.isOk(fakeCache.put.calledOnce);
          assert.isOk(fakeCache.put.calledWith(request, networkResponse));
        });
    });

  });

  describe('get() when network is available but times out', function() {
    var networkResponse = new Response('network success!');
    var cacheResponse = new Response('cache success!');

    before(function() {
      fakeCache.match = sinon.stub().returns(Promise.resolve(cacheResponse));
      sinon.stub(self, 'fetch').returns(new Promise(fulfil => {
        setTimeout(() => fulfil(networkResponse), MORE_THAN_NETWORK_TIMEOUT);
      }));
    });

    after(function() {
      self.fetch.restore();
    });

    addByPassWhenNetwork(networkResponse);

    it('fetches from cache', function() {
      wpOffline.get(new Request('test/url'))
      .then(response => {
        assert.strictEqual(response, cacheResponse);
      });
    });

    it('stores a fresh copy in the cache', function() {
      var request = new Request('some/url');
      return wpOffline.get(request)
        .then(() => {
          assert.isOk(fakeCache.put.calledOnce);
          assert.isOk(fakeCache.put.calledWith(request, networkResponse));
        });
    });
  });

  describe('get() when network is not available', function() {

    addByPassWhenNoNetwork();

    it('fetches from cache if there is a match', function() {

    });

    it('error if there is no match', function() {

    });

  });
});
