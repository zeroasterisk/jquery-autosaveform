/**
 * Configuration:
 * For any form that you want to autosave, set class="autosave"
 * If you want to use any interval other than the default (30 seconds) specify the following attribute on the form element: autosave-length="10"
 * If you want to use an alternate post URL (default is form action + /autosave.json), specify the following attribute on the form element: autosave-url="/some/postback.json"
 * Create a node with class="autosave-status" to determine where the "Auto-saved 9 seconds ago" text will go... if you don't make one, one will be appended to the form for you
 * If you want to trigger a premature autosave, call $(form).trigger('autosave')
 * If you want to specify event handlers to run after autosave completes, define events as such: $(form).on('saved', function(){ });
 *
 *
 * form class
 *   'autosave' - this turns on autosave functionality
 * form data
 *   'autosave-save-interval' - control the autosave interval for this form
 *   'autosave-status-interval' - control the autosave status update interval for this form
 *   'autosave-lastsave' - unix timestamp (+ms) at last autosave
 *   'autosave-save-interval-id' - window.setInterval id
 *   'autosave-status-interval-id' - window.setInterval id
 *
 * form events
 *   'autosave.Autosave' - actually does the autosave of the form
 *   'saved.Autosave' - internal "on complete/success" callback
 *     NOTE: you can define your own 'saved' event to get a custom callback
 *       triggered on Autosave success.
 *   'status.Autosave' - updates the status message, eg: saved # seconds ago
 *   'setup_intervals.Autosave' - (re) sets the intervals for autosaving and updating status
 */
var __autosave_config__ = {
	// interval times in seconds
	interval_save: 30,
	interval_status: 1
};
var autosave = function() {
	$('form.autosave').each(function() {
		var form = this;
		if ($(form).attr('autosave-setup') == '1') {
			// Don't re-setup
			return true;
		}

		$(form).on('autosave.Autosave', function() {
			if ($(form).attr('autosave-url') != undefined) {
				var url = $(form).attr('autosave-url');
			} else {
				var url = $(form).attr('action');
				if (!url.match('/\/$/')) {
					url += '/';
				}
				url += 'autosave.json';
			}
			// form data
			var data = $(form).serialize();
			// on success function
			//   if you want to override, define your own 'saved' callback
			var success = function() {
				lastsave = new Date().getTime();
				$(form).data('autosave-lastsave', lastsave);
				// trigger 'saved' callback, un-namespaced to support custom events
				$(form).trigger('saved', true);
			};
			$.ajax({
				method: 'post',
				url: url,
				data: data,
				dataType: 'html',
				success: function(response, status, xhr) {
					success();
				},
				error: function(xhr, status, error) {
					if (xhr.status == 302) {
						// Basically a 200 but jQuery doesn't know that
						success();
					} else {
						console.dir(['autosave error', xhr, status, error]);
					}
				}
			});
		});

		$(form).on('saved.Autosave', function(e, status) {
			if (status == undefined || status == 'success') {
				status = true;
			} else {
				status = false;
			}
			$(form).addClass('saved ' + (status ? 'saved-success' : 'saved-failure'));
			// trigger status update (so we don't have to wait till the next interval
			$(form).trigger('status.Autosave');
		});

		$(form).on('status.Autosave', function(e) {
			// form = e.target // (not needed)
			var lastsave = $(form).data('autosave-lastsave');
			if (typeof lastsave != 'number') {
				// not yet autosaved... do nothing
				return false;
			}
			var seconds = (new Date().getTime() - lastsave) / 1000;
			if (seconds < 3) {
				var time = 'just now';
			} else {
				var time = '' + parseInt(seconds, 10) + ' seconds ago';
			}
			if ($(form).find('.autosave-status').length < 1) {
				// Populate the status node if it doesn't exist
				$(form).append($('<div>').addClass('autosave-status'));
			}
			$(form).find('.autosave-status').html('Auto-saved ' + time);
		});

		$(form).on('setup_intervals.Autosave', function(e) {
			// clear existing, if set
			try {
				window.clearInterval( $(form).data('autosave-save-interval-id') );
				window.clearInterval( $(form).data('autosave-status-interval-id') );
			} catch (ase) {}
			// determine settings
			var interval_save = __autosave_config__.interval_save; // Default to 30 seconds
			if ($(form).data('autosave-save-interval') != undefined) {
				interval_save = parseInt($(form).data('autosave-save-interval'));
			}
			if (interval_save < 3 || isNaN(interval_save)) {
				interval_save = 3;
			}
			var interval_status = __autosave_config__.interval_status; // Default to 30 seconds
			if ($(form).data('autosave-status-interval') != undefined) {
				interval_status = parseInt($(form).data('autosave-status-interval'));
			}
			if (interval_status < 1 || isNaN(interval_status)) {
				interval_status = 1;
			}
			// set
			$(form).data('autosave-save-interval-id', window.setInterval(function() { try { $(form).trigger('autosave.Autosave'); } catch(e) {} }, interval_save * 1000));
			$(form).data('autosave-status-interval-id', window.setInterval(function() { try { $(form).trigger('status.Autosave'); } catch(e) {} }, interval_status * 1000));
		});

		// finalize setup
		$(form).trigger('setup_intervals.Autosave');
		$(form).attr('autosave-setup', '1');
	});
};

$(autosave);
