-- 高松 送迎車の写真（project B ggqugvyskyiblxiycpci）
update public.hdm_shuttle_vehicles
   set photo_url='https://nosh2318.github.io/spk-task/images/shuttle/tkm-1002.jpg', updated_at=now()
 where id='tkm-1002';
select id,label,plate,photo_url from public.hdm_shuttle_vehicles where id='tkm-1002';
