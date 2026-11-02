-- 戻し：画面からの読み書きを止める。保存済みの暗号データは残す（物理削除しない）
revoke all on function public.ota_cfg_list(text) from authenticated;
revoke all on function public.ota_cfg_save(text,bigint,text,text,text,text,text,text,timestamptz) from authenticated;
