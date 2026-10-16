/* seed.js — dữ liệu demo nạp idempotent khi database mới được khởi tạo. */
window.TTV = window.TTV || {};
(function (TTV) {
  'use strict';
  var SEED_VERSION = '2026-10-v15';
  var POLICY_UPDATED_AT = '2026-10-15T00:00:00.000Z';
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
  function makePolicy(id, title, sections) {
    return {
      id: id, type: id, title: title, updated_at: POLICY_UPDATED_AT,
      content: sections.map(function (s) {
        return [s.title].concat(s.paras || []).join('\n\n');
      }).join('\n\n')
    };
  }
  var TERMS_POLICY = makePolicy('terms', 'Điều khoản sử dụng', [
    { title: '1. Giới thiệu', paras: ['Chào mừng bạn đến với TingTingVac. Khi sử dụng ứng dụng và dịch vụ của chúng tôi, bạn đồng ý tuân thủ các điều khoản và điều kiện được quy định trong tài liệu này. Nếu bạn không đồng ý với bất kỳ điều khoản nào, vui lòng ngừng sử dụng dịch vụ.'] },
    { title: '2. Dịch vụ của TingTingVac', paras: ['TingTingVac là nền tảng kết nối khách hàng có nhu cầu bốc vác với đội ngũ thợ chuyên nghiệp. Chúng tôi cung cấp các tính năng tạo đơn, ghép đơn, theo dõi đơn hàng, thanh toán và các dịch vụ liên quan khác.'] },
    { title: '3. Tài khoản người dùng', paras: ['Bạn cần đăng ký tài khoản để sử dụng dịch vụ. Bạn cam kết cung cấp thông tin chính xác, đầy đủ và cập nhật. Bạn có trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động diễn ra dưới tài khoản của mình.'] },
    { title: '4. Quyền và nghĩa vụ của người dùng', paras: [
      'Bạn đồng ý sử dụng dịch vụ đúng mục đích, không vi phạm pháp luật, không đăng tải nội dung gây hại, lừa đảo, xâm phạm quyền của bên khác hoặc ảnh hưởng đến hệ thống của chúng tôi.',
      'Bạn có trách nhiệm thanh toán đầy đủ các khoản phí (nếu có) theo quy định khi sử dụng dịch vụ.'
    ] },
    { title: '5. Thanh toán', paras: ['Các khoản thanh toán được thực hiện thông qua Ví điện tử TingTingVac hoặc bằng tiền mặt theo lựa chọn khi đặt đơn. Chi tiết các khoản phí và cách tính sẽ được hiển thị rõ ràng trước khi bạn xác nhận đặt đơn.'] },
    { title: '6. Hủy đơn và hoàn tiền', paras: ['Việc hủy đơn và hoàn tiền được thực hiện theo Chính sách hoàn tiền của TingTingVac. Vui lòng tham khảo chính sách hoàn tiền để biết thêm thông tin chi tiết.'] },
    { title: '7. Giới hạn trách nhiệm', paras: ['TingTingVac không chịu trách nhiệm đối với các thiệt hại gián tiếp, ngẫu nhiên hoặc hậu quả phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ, trừ trường hợp pháp luật có quy định khác.'] },
    { title: '8. Thay đổi điều khoản', paras: ['Chúng tôi có quyền cập nhật, sửa đổi điều khoản này vào bất kỳ thời điểm nào. Mọi thay đổi sẽ có hiệu lực kể từ thời điểm được đăng tải trên ứng dụng. Việc bạn tiếp tục sử dụng dịch vụ sau khi điều khoản được cập nhật đồng nghĩa với việc bạn chấp nhận các thay đổi đó.'] }
  ]);
  var PRIVACY_POLICY = makePolicy('privacy', 'Chính sách bảo mật', [
    { title: '1. Thông tin chúng tôi thu thập', paras: ['Chúng tôi thu thập thông tin bạn cung cấp khi đăng ký và sử dụng dịch vụ (họ tên, số điện thoại, email, địa chỉ) cùng thông tin phát sinh trong quá trình sử dụng (đơn hàng, giao dịch, vị trí khi đặt đơn).'] },
    { title: '2. Mục đích sử dụng', paras: ['Thông tin được dùng để cung cấp, vận hành và cải thiện dịch vụ; ghép thợ phù hợp; xử lý thanh toán; hỗ trợ khách hàng và đảm bảo an toàn cho nền tảng.'] },
    { title: '3. Bảo mật thông tin', paras: ['Số điện thoại và dữ liệu nhạy cảm được mã hóa khi lưu trữ. Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức hợp lý để bảo vệ thông tin của bạn.'] },
    { title: '4. Chia sẻ thông tin', paras: ['Chúng tôi chỉ chia sẻ thông tin cần thiết với thợ được ghép để hoàn thành đơn, và với các đối tác cổng thanh toán/định danh chính thức. Chúng tôi không bán thông tin cá nhân của bạn.'] },
    { title: '5. Quyền của bạn', paras: ['Bạn có quyền truy cập, cập nhật thông tin cá nhân trong ứng dụng hoặc yêu cầu hỗ trợ qua tổng đài.'] }
  ]);
  var REFUND_POLICY = makePolicy('refund', 'Chính sách hoàn tiền', [
    { title: '1. Điều kiện hoàn tiền', paras: ['Bạn được hoàn tiền khi hủy đơn hợp lệ trước khi thợ bắt đầu công việc, hoặc khi đơn không thể thực hiện do lỗi từ phía nền tảng/thợ.'] },
    { title: '2. Quy trình hoàn tiền', paras: ['Với đơn thanh toán bằng Ví, số tiền giữ tạm (escrow) sẽ được hoàn lại số dư ví ngay sau khi hủy hợp lệ. Với các trường hợp khác, thời gian hoàn tiền tùy thuộc vào cổng thanh toán.'] },
    { title: '3. Trường hợp không hoàn tiền', paras: ['Đơn đã hoàn thành, hoặc hủy sau khi thợ đã bắt đầu công việc, có thể không được hoàn toàn bộ chi phí. Mức khấu trừ (nếu có) sẽ được thông báo rõ ràng.'] },
    { title: '4. Khiếu nại', paras: ['Nếu bạn cho rằng việc hoàn tiền chưa chính xác, vui lòng mở tranh chấp hoặc liên hệ tổng đài để được hỗ trợ giải quyết.'] }
  ]);
  var policies = [TERMS_POLICY, PRIVACY_POLICY, REFUND_POLICY];
  function putPolicySeed(store, row) {
    return store.get('policies', row.id).then(function (cur) {
      var text = String((cur && cur.content) || '');
      if (text.length > 80 && !/Dữ liệu bản demo|mô phỏng luồng/.test(text)) {
        var old = String((cur && cur.updated_at) || '');
        if (old.indexOf('2025-05-10') === 0) {
          return store.put('policies', Object.assign({}, cur, { updated_at: POLICY_UPDATED_AT }));
        }
        return cur;
      }
      return store.put('policies', row);
    });
  }
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
      var write = store.putAll
        ? store.putAll(table, records)
        : records.reduce(function (chain, record) { return chain.then(function () { return store.put(table, record); }); }, Promise.resolve());
      return write.then(function () { return {table:table,inserted:records.length,skipped:false}; });
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
              return putPolicySeed(store, TERMS_POLICY);
            }).then(function () {
              return putPolicySeed(store, PRIVACY_POLICY);
            }).then(function () {
              return putPolicySeed(store, REFUND_POLICY);
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
