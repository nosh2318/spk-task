//header menu
$(function () {
	$("#js-hamburger-menu, .navigation__link").on("click", function () {
		$(".navigation").toggleClass("panelactive");
		$(".hamburger-menu").toggleClass("hamburger-menu--open");
		$(".header_bg").toggleClass("hamburger-menu--open");
		$(".header").toggleClass("hamburger-menu--open");
	});
});

//アコーディオン
$(function () {
	$(".js-accordion-title").on("click", function () {
		$(this).next().slideToggle(300);
		$(this).toggleClass("open", 300);
	});
});

//search_modal　予約モーダル
$(function () {
	var open = $(".modal-open"),
		close = $(".modal-close"),
		container = $(".modal-container");

	open.on("click", function () {
		container.addClass("active");
		return false;
	});

	close.on("click", function () {
    var openingDatepicker = $('#ui-datepicker-div').css('display') !== 'none'
    if (!openingDatepicker) {
      container.removeClass("active");
    }
	});

	$(document).on("click", function (e) {
    var openingDatepicker = $('#ui-datepicker-div').css('display') !== 'none'
		if (!$(e.target).closest(".modal-body").length && !openingDatepicker) {
			container.removeClass("active");
		}
	});
});

//information_modal　オプション選択ページ「〇〇について」のモーダル
$(function () {
	$(".md-btn").each(function () {
		$(this).on("click", function (e) {
			e.preventDefault();
			var target = $(this).data("target");
			var modal = document.getElementById(target);
			$("html, body").css("overflow", "hidden");
			$(modal).find(".md-overlay,.md-contents").fadeIn();
		});
	});
	$(".md-close").on("click", function () {
		$("html, body").removeAttr("style");
		$(".md-overlay,.md-contents").fadeOut();
	});
});

//車両クラスページの約款にチェックを入れるとボタンをクリック可能に
$(document).ready(function () {
	// 初期状態でdisabledクラスを付与
	$(".check_btn").addClass("disabled");

	$("#clause").change(function () {
		if ($(this).is(":checked")) {
			$(".check_btn").removeClass("disabled");
		} else {
			$(".check_btn").addClass("disabled");
		}
	});
});
