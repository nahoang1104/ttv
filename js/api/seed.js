/* seed.js — dữ liệu demo nạp idempotent khi database mới được khởi tạo. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var SEED_VERSION = '2026-10-v8';
  var services = [
    {id:'moving',code:'moving',name:'Chuyển nhà',desc:'Chuyển nhà trọn gói, có thợ + xe',icon:'🏠',base_price:50000,unit:'lượt'},
    {id:'warehouse',code:'warehouse',name:'Bốc xếp kho',desc:'Bốc/dỡ hàng kho, tính theo khối',icon:'📦',base_price:100000,unit:'khối'},
    {id:'furniture',code:'furniture',name:'Nội thất',desc:'Tháo lắp & vận chuyển đồ nội thất',icon:'🛋️',base_price:100000,unit:'lượt'},
    {id:'office',code:'office',name:'Văn phòng',desc:'Chuyển văn phòng, thiết bị',icon:'🏢',base_price:100000,unit:'lượt'},
    {id:'construction',code:'construction',name:'Công trình',desc:'Bốc xếp vật liệu xây dựng',icon:'🧱',base_price:100000,unit:'lượt'},
    {id:'hourly',code:'hourly',name:'Theo giờ',desc:'Thuê thợ bốc vác theo giờ',icon:'⏱️',base_price:100000,unit:'giờ'},
    {id:'goods',code:'goods',name:'Bốc vác hàng hóa',desc:'Bốc/dỡ, vận chuyển hàng hóa lẻ',icon:'🚚',base_price:100000,unit:'lượt'}
  ];
  var pricing = [{id:'default',weight_tiers:[
    {id:'light',code:'light',name:'Nhẹ',description:'Dưới 30 kg — vài thùng, đồ lặt vặt',price:15000},
    {id:'medium',code:'medium',name:'Vừa',description:'30–100 kg — đồ 1 phòng, vài món nội thất',price:57000},
    {id:'heavy',code:'heavy',name:'Nặng',description:'100–300 kg — đồ cả căn hộ',price:160000},
    {id:'very_heavy',code:'very_heavy',name:'Rất nặng',description:'Trên 300 kg — nhà nguyên căn, kho hàng',price:330000}
  ],floor_fee:15000,elevator_discount:0.7,km_fee:10000,extra_worker_fee:107000,speed_multipliers:{default:1,fast:1.25,urgent:1.2},min_amount:10000,quote_window_min:30}];
  var vendors = [
    {id:'vendor-demo-team',name:'Tổ bốc xếp Thành Công',type:'team',username:'thanhcong',phone:'0900000001',rating:4.8,jobs_done:128,team_size:5,services:['moving','warehouse','furniture','office','construction','hourly','goods'],areas:['Ho Chi Minh City'],vehicle:'Xe tải',commission_rate:15,is_online:true,status:'active',kyc_status:'approved',wallet_balance:500000,avatar_path:'',created_by:'seed'},
    {id:'vendor-demo-company',name:'Công ty Vận chuyển An Phát',type:'company',username:'anphat',phone:'0900000002',rating:4.7,jobs_done:96,team_size:10,services:['moving','warehouse','office','goods'],areas:['Ho Chi Minh City'],vehicle:'Xe tải 1.5 tấn',commission_rate:15,is_online:true,status:'active',kyc_status:'approved',wallet_balance:800000,avatar_path:'',created_by:'seed'},
    {id:'vendor-demo-person',name:'Nguyễn Văn Bốc',type:'personal',username:'thoboc',phone:'0900000003',rating:4.6,jobs_done:54,team_size:1,services:['furniture','hourly','goods'],areas:['Ho Chi Minh City'],vehicle:'Xe máy',commission_rate:15,is_online:false,status:'active',kyc_status:'pending',wallet_balance:200000,avatar_path:'',created_by:'seed'}
  ];
  var coupons = [
    {id:'TTVNEW10',code:'TTVNEW10',title:'Khách mới giảm 10%',condition:'Giảm 10% cho đơn từ 100.000đ',min_workers:2,discount_type:'percent',discount_value:10,max_discount:50000,min_order:100000,expires_at:'2027-12-31T23:59:59.000Z',status:'active'},
    {id:'SUMMER20',code:'SUMMER20',title:'Giảm giá hè 20%',condition:'Đơn tối thiểu 30.000đ',min_workers:2,discount_type:'percent',discount_value:20,max_discount:50000,min_order:30000,expires_at:'2026-08-16T23:59:59.000Z',status:'expired'}
  ];
  var faqs = [
    {id:'faq-order-1',category:'order',question:'Làm sao để đặt đơn bốc vác?',answer:'Chọn dịch vụ, nhập điểm bốc và điểm trả, điền thông tin hàng hóa rồi xác nhận đặt đơn.',sort:1},
    {id:'faq-order-2',category:'order',question:'Tôi có thể hủy đơn không?',answer:'Bạn có thể hủy khi đơn chưa hoàn thành. Khoản tiền đã tạm giữ trong ví sẽ được hoàn theo trạng thái đơn.',sort:2},
    {id:'faq-payment-1',category:'payment',question:'Tôi có thể thanh toán bằng cách nào?',answer:'Bản demo hỗ trợ tiền mặt hoặc số dư ví.',sort:1},
    {id:'faq-wallet-1',category:'wallet',question:'Nạp tiền có mất phí không?',answer:'Phí nạp tiền trong ứng dụng là 0đ.',sort:1},
    {id:'faq-account-1',category:'account',question:'Tôi cần hỗ trợ tài khoản ở đâu?',answer:'Mở mục Cá nhân → Trợ giúp & Hỗ trợ để gửi yêu cầu.',sort:1}
  ];
  var policies = [
    {id:'terms',type:'terms',title:'Điều khoản sử dụng',content:'Khi sử dụng TingTingVac bản demo, người dùng chịu trách nhiệm về thông tin đã cung cấp. Các dịch vụ thanh toán và đăng nhập bên ngoài chỉ được mô phỏng.',updated_at:'2026-10-09T00:00:00.000Z'},
    {id:'privacy',type:'privacy',title:'Chính sách bảo mật',content:'Dữ liệu bản demo được lưu trong trình duyệt hiện tại. Không nhập thông tin bí mật hoặc dữ liệu cá nhân thật vào môi trường demo.',updated_at:'2026-10-09T00:00:00.000Z'},
    {id:'refund',type:'refund',title:'Chính sách hoàn tiền',content:'Các khoản giữ và hoàn tiền chỉ mô phỏng luồng nghiệp vụ; không phát sinh giao dịch thanh toán thật.',updated_at:'2026-10-09T00:00:00.000Z'}
  ];
  var banners = [
    {id:'banner-welcome',title:'Ưu đãi Hội viên',subtitle:'Tiết kiệm đến 20% mọi đơn bốc vác',type:'member',target:'coupon',image_path:'uploads/img-giaodien/uudaihoivien.png',sort:1,active:true},
    {id:'banner-coupon',title:'Ưu đãi khách mới',subtitle:'Nhập mã TTVNEW10',type:'promo',target:'coupon',image_path:'uploads/img-giaodien/chuyennhabaner.png',sort:2,active:true},
    {id:'banner-explore',title:'Dịch vụ an tâm',subtitle:'Đội ngũ thợ sẵn sàng hỗ trợ',type:'explore',target:'none',image_path:'uploads/img-giaodien/bocxepkhochuyennghiep.png',sort:3,active:true}
  ];
  var settings = [
    {id:'commission_default',key:'commission_default',value:15},
    {id:'demo_quote_bot_enabled',key:'demo_quote_bot_enabled',value:true},
    {id:'vendor_wallet_negative_limit',key:'vendor_wallet_negative_limit',value:-500000},
    {id:'hotline',key:'hotline',value:'1900 0000'},
    {id:'support_email',key:'support_email',value:'support@tingtingvac.example'},
    {id:'zalo_url',key:'zalo_url',value:'https://zalo.me'},
    {id:'quick_topup_amounts',key:'quick_topup_amounts',value:[50000,100000,200000,500000,1000000,2000000]},
    {id:'topup_fee',key:'topup_fee',value:0},
    {id:'default_quote_window_min',key:'default_quote_window_min',value:30} /* không dùng — phút chờ lấy từ pricing_config.quote_window_min */
  ];
  function seedTable(store, table, records) {
    return store.count(table).then(function (count) {
      if (count > 0) return {table:table,inserted:0,skipped:true};
      return records.reduce(function (chain, record) { return chain.then(function () { return store.put(table, record); }); }, Promise.resolve()).then(function () { return {table:table,inserted:records.length,skipped:false}; });
    });
  }
  TTV.Seed = {
    version: SEED_VERSION,
    run: function (options) {
      options = options || {};
      var store = TTV.Store;
      if (!store) return Promise.reject(new Error('TTV.Store chưa được nạp.'));
      return store.get('__meta', 'seed_version').then(function (meta) {
        if (meta && meta.value === SEED_VERSION && !options.force) return {seeded:false,reason:'already-seeded',version:SEED_VERSION};
        if (meta && meta.value && meta.value !== SEED_VERSION && !options.force) {
          return Promise.all(banners.map(function (b) {
            return store.get('banners', b.id).then(function (cur) {
              return store.put('banners', cur ? Object.assign({}, cur, { image_path: b.image_path }) : b);
            });
          })).then(function () { return store.get('pricing_config', 'default'); }).then(function (pc) {
              if (!pc) return store.put('pricing_config', pricing[0]);
              var base = pricing[0];
              var merged = Object.assign({}, base, pc);
              merged.weight_tiers = (pc.weight_tiers && pc.weight_tiers.length) ? pc.weight_tiers : base.weight_tiers;
              merged.speed_multipliers = Object.assign({}, base.speed_multipliers, pc.speed_multipliers || {});
              return store.put('pricing_config', merged);
            }).then(function () {
              return store.put('__meta', {id:'seed_version',value:SEED_VERSION,seeded_at:new Date().toISOString(),migrated_from:meta.value}).then(function () {
                return {seeded:false,reason:'migrated',version:SEED_VERSION,from:meta.value};
              });
            });
        }
        var plan = [
          ['services',services],['pricing_config',pricing],['vendors',vendors],['coupons',coupons],
          ['faqs',faqs],['policies',policies],['banners',banners],['app_settings',settings]
        ];
        return plan.reduce(function (chain, item) { return chain.then(function (results) { return seedTable(store,item[0],item[1]).then(function (result) { results.push(result); return results; }); }); }, Promise.resolve([])).then(function (results) {
          return store.put('staff',{id:'admin',username:'admin',name:'Quản trị viên cao nhất',role:'SUPER_ADMIN',status:'active',must_change_pw:true,password_hash:'',salt:'',created_at:'2026-10-09T00:00:00.000Z',seed_password_hint:'Admin@12345'}).then(function () {
            return store.put('__meta',{id:'seed_version',value:SEED_VERSION,seeded_at:new Date().toISOString()}).then(function () { return {seeded:true,version:SEED_VERSION,tables:results,staff:'admin'}; });
          });
        });
      });
    }
  };
})(window.TTV);
