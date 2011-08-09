/**
* jQuery AutoSaveForm
*
* @author Alan Blount alan+asf@zeroasterisk.com
* @version 1.0.0
* @date 2011.08.09
* @link https://github.com/zeroasterisk/jquery-autosaveform
*
* NO COPYRIGHTS OR LICENSES. DO WHAT YOU LIKE.
*
*/
/*
### USAGE: setting up any number of forms, default options ###

$("#my-container form").autoSaveForm();

### USAGE: setting up one form by ID, custom options ###

$("#MyForm").autoSaveForm({
	autosave_frequency: 0, 										# autosave disabled
	autosave_onclick: "#my-container a[href]:not([rel])",		# custom links to be bound as autosavefirst
	form_inputs: "select",										# only considering selects in the form
	attr_data: "data-ASFcustom-serialize",						# customize internal attributes for forms' data
	attr_status: "data-ASFcustom-status",						# customize internal attributes for forms' status
	form_response_regex: "Saved"								# save response must contain: Saved
	form_action: "/myform/submit.php"							# over-ride the submit action for the form (edge case)
	});

### EXTRA: bind event handlers for callbacks ###

$("#MyForm").autoSaveForm({
	form_response_regex: "Saved"
}).bind("autosave_complete", function() {
	pageTracker._trackEvent("ajax", "autoSaveForm", window.location.href, $(this).attr("action"));
}).bind("autosave_error", function() {
	pageTracker._trackEvent("ajax", "autoSaveFormERROR", window.location.href, $(this).attr("action"));
});

### EXTRA CONFIGURATIONS ###

$.fn.ASF_beforeunload = false; 									# disable onbeforeunload functionality
$.fn.ASF_beforeunload_message = "are you sure?";				# custom message before unload (if we need to prompt)
$.fn.ASF_debug = true;											# turn on debug messages in console

*/
(function ($) {
	// plugin options defaults (set per form)
	$.fn.ASF_option_defaults = {
		autosave_frequency: 500000, // set to number of miliseconds you want autosave to run...  0 to disable // 60 * 5 * 1000 = 5 min
		autosave_onclick: "body a[href]:not([rel])",
		form_inputs: "input, select, textarea",
		attr_data: "data-ASF-serialize",
		attr_status: "data-ASF-status",
		form_response_regex: "", // if set, the response must match to continue
		form_action: "" // would override form.action
	};
	// plugin constants we keep track of, you shouldn't change
	$.fn.ASF_debug = false;
	$.fn.ASF_beforeunload = true;
	$.fn.ASF_beforeunload_message = "This page is asking you to confirm that you want to leave - any data you have entered may not be saved.";
	// primary function, setup forms
	$.fn.autoSaveForm = function (options) {
		if (!this.length) {
			return false;
		}
		// build main options before element iteration
		var options = $.extend({}, $.fn.ASF_option_defaults, options || {});
		// iterate and reformat each matched element
		$(this).each(function (i, form) {
			// setup form
			$(form).data("ASF_options", options);
			var formData = $(form).find(options.form_inputs).serialize();
			$(form).attr(options.attr_data, formData);
			$(form).attr(options.attr_status, "init");
			if (parseInt(options.autosave_frequency) > 0) {
				// ensure form has an ID (how we are going to trigger after setTimeout)
				if (!$(form).attr("id")) {
					$(form).attr("id", "ASF"+$(window).data("ASF_forms").length+(new Date).getTime());
				}
				// bind an action which re-triggers the setTimeout and triggers the autosave
				$(form).bind("autosave_periodic.autosaveform", function(e) {
					options = $(this).data("ASF_options");
					// are we ready for autosave?
					if ($(this).data("ASF_periodic")=="ready") {
						asflog("ASF_periodic: ran", $(this));
						$(this).trigger('autosave.autosaveform');
					}
					// re-trigger
					setTimeout("$('#"+$(this).attr("id")+"').trigger('autosave_periodic.autosaveform');", options.autosave_frequency);
				}).trigger("autosave_periodic.autosaveform").data("ASF_periodic", "ready");
			}
			// setup form autosave event
			$(form).bind("autosave.autosaveform", function(e) {
				if ($(this).ASF_status()=="unchanged") {
					return true; // no changes
				}
				options = $(this).data("ASF_options");
				// check jQueryTools Validator
				if ($(this).data("validator")) {
					if (!$(this).data("validator").checkValidity()) {
						$(this).attr(options.attr_status, "not valid");
						return false; // not valid
					}
				}
				// setup form
				var form_action = $(this).attr("action");
				if (options.form_action.length > 0) {
					form_action = options.form_action;
				}
				var formData = $(this).find(options.form_inputs).serialize();
				// save/submit form
				$.ajax({
					async: false,
					cache: false,
					type: "POST",
					url: form_action,
					data: formData,
					form: $(this),
					formData: formData,
					formAction: form_action,
					success: function(data, textStatus, jqXHR) {
						options = this.form.data("ASF_options");
						this.form.attr(options.attr_data, this.formData).attr(options.attr_status, 'saved');
						if (options.form_response_regex.length > 0) {
							var regex = new RegExp(options.form_response_regex);
							if (!data.match(regex)) {
								asflog("Autosave Complete, Regex Failed", $(form), data, textStatus);
								this.form.attr(options.attr_status, 'saved-regex-failed');
							}
						}
						this.form.data("autosave_data", data);
						this.form.trigger("autosave_complete.autosaveform");
					},
					error: function() {
						this.form.trigger("autosave_error.autosaveform");
					}
				});
			});
			// add form to list of ASF_forms
			ASF_forms = $(window).data("ASF_forms");
			if (typeof(ASF_forms)=="object" && ASF_forms.length > 0) {
				ASF_forms.push(form);
			} else {
				ASF_forms = [form];
			}
			$(window).data("ASF_forms", ASF_forms);
			// activate onclick for specified links (cleaner than relying on unload)
			$(options.autosave_onclick).bind("click.autosaveform", function(e) {
				// should we autosave?
				if ($(this).attr("href").indexOf("#")==0 || $(this).closest(".tool-tabs").size() == 1) {
					asflog("Clicked on link, was a bookmark or tab", $(this), $(form));
					return true; // bookmark or tab
				}
				if ($(form).ASF_status()=="unchanged") {
					asflog("Clicked on link, status == unchanged", $(this), $(form));
					return true; // no changes, just continue to link
				}
				// trigger autosave
				ASF_forms = $(window).data("ASF_forms");
				console.log("autosave.click", $(this), $(form), ASF_forms);
				if ($.isArray(ASF_forms) && ASF_forms.length > 0) {
					$(ASF_forms).each(function(i, form) {
						options = $(form).data("ASF_options");
						$(form).trigger("autosave");
						if (!$(form).ASF_check_status($(form).ASF_status())) {
							asflog("Click Blocked. Form Status: " + $(form).attr(options.attr_status), $(this), $(form));
							return false;
						}
					});
				}
				asflog("Clicked on link, continued", $(this), $(form));
				// continue
				return true;
			});
		});
		// activate ASF_beforeunload (if not already done)
		if ($.fn.ASF_beforeunload) {
			$.fn.ASF_beforeunload = false; // no need to re-initialize
			$(window).bind("beforeunload.autosaveform", function() {
				console.log("beforeunload", $(window).data("ASF-beforeunload-status"));
				$(window).data("ASF-beforeunload-prompt", $.fn.ASF_beforeunload_message);
				$(window).data("ASF-beforeunload-status", "init-unload");
				ASF_forms = $(window).data("ASF_forms");
				if ($.isArray(ASF_forms) && ASF_forms.length > 0) {
					$(ASF_forms).each(function(i, form) {
						options = $(form).data("ASF_options");
						$(form).trigger("autosave");
						if (!$(form).ASF_check_status($(form).attr(options.attr_status))) {
							$(window).data("ASF-beforeunload-status", $(form).attr(options.attr_status));
						}
					});
				}
				console.log("beforeunload", $(window).data("ASF-beforeunload-status"));
				if ($(window).data("ASF-beforeunload-status") == "init-unload") {
					asflog("beforeunload continues: All Forms Fine");
					$(window).data("ASF-beforeunload-prompt", "");
				}
				if ($(window).ASF_check_status($(window).data("ASF-beforeunload-status"))) {
					asflog("beforeunload continues: Window Statuses Checkout");
					$(window).data("ASF-beforeunload-prompt", "");
				}
				if ($(window).data("ASF-beforeunload-prompt").length > 0) {
					asflog("Unload Blocked. Window Statuses: " + $(window).data("ASF-beforeunload-status"));
					$(window).trigger("beforeunloadfailed");
					return $(window).data("ASF-beforeunload-prompt");
				}
			});
		}
		return this;
	};
	// helper function to check for "ok" statuses
	$.fn.ASF_check_status = function (status) {
		asflog("ASF_check_status", status);
		return (status == "saved" || status == "unchanged")
	}
	// helper function to check the status of the data in the form from the last version
	$.fn.ASF_status = function () {
		var newStatus = "unknown";
		this.each(function (i, form) {
			options = $(form).data("ASF_options");
			var newData = $(form).find(options.form_inputs).serialize();
			if ($(form).attr(options.attr_data)==newData) {
				newStatus = "unchanged";
			} else {
				newStatus = "changed";
			}
			$(form).attr(options.attr_status, newStatus);
		});
		return newStatus;
	}
	// helper function for console logging
	asflog = function() {
		var identify = '[jquery.autosaveform]';
		if ($.fn.ASF_debug) {
			if (window.console && window.console.log)
				window.console.log(identify, arguments);
			else if (window.opera && window.opera.postError)
				window.opera.postError(identify, arguments);
		}
		return identify + ' ' + Array.prototype.join.call(arguments,'').replace(/\[object Object\]/gi, '');
	};
	//end of closure
}(jQuery));
