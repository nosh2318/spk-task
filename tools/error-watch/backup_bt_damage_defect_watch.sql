CREATE OR REPLACE FUNCTION public.bt_damage_defect_watch(p_mode text, p_notify boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _tok text := private.slack_bot_token('slack_bot_token');
  _today date := (now() at time zone 'Asia/Tokyo')::date;
  _day date := case when p_mode = 'eve' then _today + 1 else _today end;
  _act text := 'damage_defect_' || p_mode;
  r record; _why text[]; _lines text[] := '{}'; _ids text[] := '{}'; _whys text[] := '{}'; _msg text; _rid bigint; _nop int;
begin
  if p_mode not in ('eve', 'fail') then return jsonb_build_object('error', 'bad mode'); end if;
  for r in
    select x.id, x.ota, x.mail, x.brand, x.start_time, x.del_time, x.created_at, f.vehicle_code, v.id tw, v.share_enabled, v.share_token, v.last_check_at, v.current_damages
    from bt_reservations x
    left join bt_fleet f on f.reservation_id = x.id
    left join vehicle_twins v on v.id = f.vehicle_code
    where x.start_date::date = _day and coalesce(x.status, '') !~* 'cancel|キャンセル'
      and not exists (select 1 from bt_line_sends s where s.resv_no = x.id and s.action = _act)
    order by coalesce(nullif(x.start_time, ''), x.del_time, '99:99')
  loop
    _why := '{}';
    if p_mode = 'eve' then
      if coalesce(r.mail, '') !~ '@' and coalesce(r.ota, '') <> '楽天' then _why := _why || '送り先が無い（メールなし）'; end if;
      if r.vehicle_code is not null then
        if r.tw is null then _why := _why || ('車 ' || r.vehicle_code || ' の傷チェックが未登録（リンクが開けない）');
        else
          if r.share_enabled is false or r.share_token is null then _why := _why || ('車 ' || r.vehicle_code || ' の共有がOFF（リンクが開けない）'); end if;
          if r.last_check_at is null then _why := _why || ('車 ' || r.vehicle_code || ' の初回チェックが未登録（画像が無い）'); end if;
          select count(*) into _nop from jsonb_array_elements(case when jsonb_typeof(r.current_damages) = 'array' then r.current_damages else '[]'::jsonb end) e where coalesce(e->>'photo', '') = '';
          if _nop > 0 then _why := _why || ('車 ' || r.vehicle_code || ' の傷 ' || _nop || '件に写真が無い'); end if;
        end if;
      end if;
      -- BUDDICA は前日20:00のメール（dayof）が傷チェックの案内
      if r.brand = 'BUDDICA' and r.mail ~ '@' and r.vehicle_code is not null and not exists (select 1 from bt_mail_log m where m.reservation_id = r.id and m.kind = 'dayof' and m.status = 'sent') then
        _why := _why || case when exists (select 1 from bt_mail_log m where m.reservation_id = r.id and m.kind = 'dayof' and m.error is not null) then '前日メールの送信エラー' else '前日メール（傷チェックの案内）が届いていない' end;
      end if;
    else
      -- HANDYMAN は当日8:00のメール（hdm_tkm_notifications damage）が傷チェックの案内
      if coalesce(r.brand, '') <> 'BUDDICA' and r.mail ~ '@' and r.created_at < now() - interval '1 hour'
         and not exists (select 1 from hdm_tkm_notifications n where n.reservation_id = r.id and n.kind = 'damage' and n.sent) then
        _why := _why || case when exists (select 1 from hdm_tkm_notifications n where n.reservation_id = r.id and n.kind = 'damage' and n.error is not null) then 'メールの送信エラー' else 'どの経路でも送れていない（朝のメールが無い）' end;
      end if;
    end if;
    if array_length(_why, 1) > 0 then
      _ids := _ids || r.id::text; _whys := _whys || array_to_string(_why, '・');
      _lines := _lines || ('• *' || coalesce(nullif(r.start_time, ''), r.del_time, '--:--') || '* ' || coalesce(public.bt_resv_label(r.id), '予約') || ' — ' || array_to_string(_why, '・'));
    end if;
  end loop;
  if coalesce(array_length(_ids, 1), 0) = 0 then return jsonb_build_object('mode', p_mode, 'day', _day, 'defects', 0); end if;
  _msg := public.hdm_msg_txt('🚨', 'tkm',
    case when p_mode = 'eve' then '傷チェックの不備 ' || array_length(_ids, 1) || '件（明日 ' || to_char(_day, 'MM/DD') || ' 出発）' else '傷チェックが届いていません ' || array_length(_ids, 1) || '件（今日出発）' end,
    null, '',
    array[case when p_mode = 'eve' then '今夜のうちに直してください（車の共有ON・初回チェックの登録・傷の写真・お客様の連絡先・前日メール）' else 'お客様に傷チェックの案内が届いていません。メールかマイページで案内してください' end, array_to_string(_lines, E'\n')],
    'https://buddica-touring.github.io/app/');
  if not p_notify then return jsonb_build_object('mode', p_mode, 'day', _day, 'defects', array_length(_ids, 1), 'text', _msg); end if;
  begin
    select net.http_post(url := 'https://slack.com/api/chat.postMessage',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _tok),
      body := jsonb_build_object('channel', 'C0BFMBLEJGZ', 'text', _msg)) into _rid;
  exception when others then _rid := null; end;
  if _rid is not null then
    for i in 1 .. array_length(_ids, 1) loop
      insert into bt_line_sends(resv_no, action, status, message, sent_at) values (_ids[i], _act, 'alerted', left('傷チェックの不備 ' || _day || ' ' || _whys[i], 300), now());
    end loop;
  end if;
  return jsonb_build_object('mode', p_mode, 'day', _day, 'defects', array_length(_ids, 1), 'posted', _rid is not null);
end $function$

