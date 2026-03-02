// file: src/quiz-data.js
// ─────────────────────────────────────────────────────────────────────────────
// Kho câu hỏi và đáp án thi trắc nghiệm Vinalink
// Muốn thêm câu mới: copy mẫu { question, answer } và paste vào cuối mảng
// answerVariants: danh sách các cách viết khác nhau của đáp án trên web
// ─────────────────────────────────────────────────────────────────────────────

const QUIZ_DATA = [
  {
    question: 'Trong chính sách trả thưởng của Vinalink Group có mấy loại hoa hồng, tiền thưởng:',
    answer:   '7',
  },
  {
    question: 'Điều kiện đạt danh hiệu Diamond?',
    answer:   'Doanh số tích lũy 4.400.000CV',
  },
  {
    question: 'Vinalink Group có bao nhiêu danh hiệu dành cho Nhà phân phối?',
    answer:   '10',
  },
  {
    question: 'Nhà phân phối khởi nghiệp là nhà phân phối nào sau đây?',
    answer:   'Là đối tác đã hoàn thành chương trình đào tạo cơ bản và được cấp thẻ thành viên bán hàng đa cấp.',
  },
  {
    question: 'Điều kiện đạt danh hiệu Emeral là gì?',
    answer:   'Doanh số nhóm tích lũy đạt 2.200.000CV',
  },
  {
    // Đáp án dài hơn phải match CHÍNH XÁC, không để bị chọn nhầm đáp án ngắn hơn
    question: 'Điều kiện đạt danh hiệu Blue Diamond?',
    answer:   'Doanh số tích lũy 6.600.000CV và Tối thiểu mỗi nhóm có 01 F1 đạt Diamond',
  },
  {
    question: 'Vinalink Group sẽ giành bao nhiêu phần trăm doanh số bán hàng (tính theo CV) toàn quốc chia theo tỷ lệ cho các danh hiệu từ Ruby trở lên.',
    answer:   '4%',
  },
  {
    question: 'Nhà phân phối Bạc trở lên mỗi khi doanh số nhóm yếu phát sinh bao nhiêu thì tạo thành 1 chu kỳ',
    answer:   '7,000 CV',
  },
  {
    // Web có typo "tổi thiểu" thay vì "tối thiểu" → thêm variant
    question: 'Doanh số năng động 1 tháng của nhà phân phối công ty quy định 1 tháng tối thiểu là bao nhiêu?',
    questionVariants: [
      'Doanh số năng động 1 tháng của nhà phân phối công ty quy định 1 tháng tổi thiểu là bao nhiêu?',
    ],
    answer:   '160 CV',
  },
  {
    question: 'Khoản hoa hồng bảo trợ tối đa nhà phân phối đạt được là bao nhiêu?',
    answer:   '1.300 CV',
  },
  {
    question: 'Tất cả các quyền lợi trong kế hoạch trả thưởng chỉ giành riêng cho những nhà phân phối sau:',
    answer:   'Nhà phân phối vàng, nhà phân phối bạc và nhà phân phối đồng đã hoàn thành chỉ tiêu năng động',
  },
  {
    question: 'Người tham gia bán hàng đa cấp bán hàng phá giá sản phẩm của công ty sẽ bị xử lý nào?',
    answer:   'Công ty được quyền xử lý vi phạm của Nhà phân phối theo quy định tại Quy tắc hoạt động của Công ty',
  },
  {
    question: 'Trường hợp nào sau đây công ty sẽ từ chối ký hợp đồng tham gia bán hàng đa cấp:',
    answer:   'Người là Công Chức của 1 trường học cấp 3.',
  },
  {
    question: 'Nhà phân phối Bạc là nhà phân phối:',
    answer:   'Tích lũy doanh số cá nhân đủ 4.000CV đến dưới 10,000 CV',
  },
  {
    // Web gõ sai "bán hang" (thiếu dấu) → dùng answerVariants để khớp cả 2
    question: 'Nhà phân phối không hoàn thành mức năng động liên tục trong 06 tháng thì:',
    answer:   'Hợp đồng tham gia bán hàng đa cấp của NPP sẽ bị chấm dứt',
    answerVariants: [
      'Hợp đồng tham gia bán hang đa cấp của NPP sẽ bị chấm dứt',
    ],
  },
  {
    // Web có typo "nhận hang" thay vì "nhận hàng"
    question: 'Thời gian người tham gia bán hàng đa cấp được quyền trả lại hàng công ty trong thời gian bao lâu kể từ ngày nhận hàng:',
    questionVariants: [
      'Thời gian người tham gia bán hàng đa cấp được quyền trả lại hàng công ty trong thời gian bao lâu kể từ ngày nhận hang:',
    ],
    answer:   '30 ngày',
  },
  {
    question: 'Tìm câu trả lời đúng nhất đối với Quy trình thực hiện đổi hàng tại Vinalink Group',
    answer:   'Nếu hàng hóa đáp ứng theo nội dung quy trình đổi sản phẩm thì bộ phận dịch vụ khách hàng làm thủ tục đổi hàng cho khách theo đúng quy định và quy trình của Công ty',
  },
  {
    question: 'Điều nào sau đây là đúng đối với quy tắc đổi trả hàng',
    answer:   'Doanh nghiệp và người tham gia BHĐC phải đảm bảo rằng đơn đặt hàng hoặc tài liệu tương ứng khác thể hiện điều khoản đổi trả hàng trong khoảng thời gian nhất định, theo quy định pháp luật, dành cho khách hàng và hoàn trả lại cho khách hàng khoản tiền hoặc các lợi ích đã nhận từ khách hàng.',
  },
  {
    question: 'Doanh số mua hàng cá nhân tối thiểu do Công ty quy định',
    answer:   'Doanh số mua hàng cá nhân tối thiểu do Công ty quy định (160CV/tháng) để đánh giá mức năng động của mỗi NPP trong tháng. NPP đã hoàn thành chỉ tiêu năng động trong tháng mới đủ điều kiện để nhận hoa hồng và tích lũy doanh số bán hàng đội nhóm của tháng năng động đó.',
  },
  {
    question: 'Điều nào sau đây là sai theo quy tắc ứng xử đối với người tiêu dùng',
    answer:   'Doanh nghiệp và người tham gia BHĐC không cần giao hàng cho khách hàng đúng thời hạn.',
  },
  {
    question: 'Thời gian bảo hành và hậu mãi phải đáp ứng đầy đủ các điều kiện nào sau đây',
    answer:   'Các điều khoản về bảo hành, chi tiết và giới hạn của dịch vụ hậu mãi, tên và địa chỉ của nhà bảo hành và Thời gian bảo hành và hoạt động sửa chữa dành cho người mua hàng phải được thể hiện rõ trong các tài liệu đi kèm hoặc tài liệu khác được giao cùng với sản phẩm.',
  },
  {
    question: 'Việc ký quỹ của tổ chức đăng ký hoạt động bán hàng đa cấp phải được thực hiện ở đâu?',
    answer:   'Ngân hàng thương mại tại Việt Nam hoặc chi nhánh ngân hàng nước ngoài tại VN',
  },
  {
    question: 'Doanh nghiệp có hành vi vi phạm Theo Nghị định 98/2020/NĐ-CP (sửa đổi bổ sung bởi Nghị định 17/2022/NĐ-CP) quy định về xử phạt vi phạm hành chính trong một số các lĩnh vực, trong đó có hoạt động BHĐC ngoài bị phạt tiền còn có thể bị áp dụng các hình thức xử phạt sau:',
    answer:   'Buộc nộp lại số lợi bất hợp pháp có được do vi phạm hành chính đối với hành vi vi phạm quy định tại điểm a khoản 3, khoản 5, điểm h, i và k khoản 7, điểm e khoản 8, điểm a, b, d, h và i khoản 9 Điều này; Buộc cải chính thông tin sai sự thật hoặc gây nhầm lẫn đối với hành vi vi phạm quy định tại điểm b khoản 3, điểm d và e khoản 9 Điều này',
  },
  {
    question: 'Hành vi nào sau đây bị cấm đối với người tham gia bán hàng đa cấp',
    answer:   'Lợi dụng chức vụ, quyền hạn, địa vị xã hội, nghề nghiệp để khuyến khích, yêu cầu, lôi kéo, dụ dỗ người khác tham gia vào mạng lưới BHĐC hoặc mua hàng hóa kinh doanh theo phương thức đa cấp',
  },
  {
    question: 'Thời lượng đào tạo tối thiểu của chương trình đào tạo kiến thức pháp luật về bán hàng đa cấp là',
    answer:   '8 tiếng',
  },
  {
    question: 'Theo Nghị định 98/2020/NĐ-CP (sửa đổi bổ sung bởi Nghị định 17/2022/NĐ-CP) quy định về xử phạt vi phạm hành chính trong một số các lĩnh vực, trong đó có hoạt động BHĐC, hành vi nào sau đây bị xử phạt từ 20.000.000 VNĐ – 30.000.000 VNĐ:',
    answer:   'Tham gia vào hoạt động của tổ chức, cá nhân kinh doanh theo phương thức đa cấp chưa được cấp giấy chứng nhận đăng ký hoạt động bán hàng đa cấp',
  },
  {
    question: 'Nghị định về quản lý hoạt động bán hàng đa cấp được áp dụng từ ngày 02/05/2018 là nghị định:',
    answer:   'Nghị định số 40/2018/NĐ-CP',
  },
  {
    question: 'Hàng hóa, dịch vụ nào dưới đây không được phép kinh doanh theo phương thức đa cấp?',
    answer:   'Thuốc, trang thiết bị y tế',
  },
  {
    question: 'Người tham gia bán hàng đa cấp không thực hiện hành vi nào dưới đây?',
    answer:   'Lôi kéo, dụ dỗ người tham gia bán hàng đa cấp của doanh nghiệp khác tham gia vào mạng lưới của doanh nghiệp mà mình đang tham gia.',
  },
  {
    question: 'Trách nhiệm của người tham gia bán hàng đa cấp trước khi tiếp thị, bán hàng là:',
    answer:   'Xuất trình Thẻ thành viên',
  },
  {
    question: 'Một trong các hành vi bán hàng đa cấp bất chính theo Nghị định 141/2018/NĐ-CP là:',
    answer:   'Không thực hiện hoặc thực hiện không đúng nghĩa vụ mua lại hàng hóa theo quy định của pháp luật.',
  },
  {
    question: 'Trong những hành vi dưới đây, hành vi nào là hành vi cấm đối với người tham gia bán hàng đa cấp:',
    answer:   'Yêu cầu người khác phải đặt cọc hoặc nộp một khoản tiền nhất định để được ký hợp đồng tham gia bán hàng đa cấp;',
  },
  {
    question: 'Theo Nghị định 98/2020/NĐ-CP (sửa đổi bổ sung bởi Nghị định 17/2022/NĐ-CP) quy định về xử phạt vi phạm hành chính trong một số các lĩnh vực, trong đó có hoạt động BHĐC, hành vi nào sau đây của người bán hàng đa cấp bị xử phạt từ 5.000.000 VNĐ – 10.000.000 VNĐ',
    answer:   'Không tuân thủ hợp đồng tham gia bán hàng đa cấp và quy tắc hoạt động của doanh nghiệp và Tham gia bán hàng đa cấp khi không đủ điều kiện tham gia bán hàng đa cấp theo quy định',
  },
  {
    question: 'Theo Nghị định 98/2020/NĐ-CP (sửa đổi bổ sung bởi Nghị định 17/2022/NĐ-CP) quy định về xử phạt vi phạm hành chính trong một số các lĩnh vực, trong đó có hoạt động BHĐC, Tổ chức hoạt động kinh doanh theo phương thức đa cấp mà không có giấy chứng nhận đăng ký hoạt động bán hàng đa cấp hoặc không đúng với nội dung giấy chứng nhận đăng ký hoạt động bán hàng đa cấp thu lợi bất chính đến dưới 200.000.000 đồng hoặc gây thiệt hại cho người khác đến dưới 500.000.000 đồng sẽ bị xử phạt',
    answer:   'Từ 80.000.000 VNĐ – 100.000.000 VNĐ',
  },
  {
    question: 'Theo Nghị định 98/2020/NĐ-CP (sửa đổi bổ sung bởi Nghị định 17/2022/NĐ-CP) quy định về xử phạt vi phạm hành chính trong một số các lĩnh vực, trong đó có hoạt động BHĐC, người tham gia bán hàng đa cấp sẽ bị xử phạt 10.000.000 đồng đến 20.000.000 đồng đối với hành vi',
    answer:   'Tổ chức hội thảo, hội nghị, đào tạo về kinh doanh theo phương thức đa cấp khi chưa được doanh nghiệp bán hàng đa cấp ủy quyền bằng văn bản; Cung cấp thông tin gian dối về lợi ích của việc tham gia bán hàng đa cấp, về hoạt động của doanh nghiệp, về tính năng, công dụng của hàng hóa hoặc cung cấp thông tin về thực phẩm bằng hình thức sử dụng hình ảnh, thiết bị, trang phục, tên, thư tín của các đơn vị, cơ sở y tế, bác sĩ, dược sĩ, nhân viên y tế, thư cảm ơn, lời cảm ơn của người bệnh, bài viết của bác sĩ, dược sĩ, nhân viên y tế hoặc cung cấp thông tin về thực phẩm có nội dung đăng tải, dẫn, trích dẫn hoặc nêu ý kiến người bệnh mô tả thực phẩm có tác dụng điều trị bệnh',
  },
];

// ─── Normalize chuỗi ─────────────────────────────────────────────────────────
function normalize(str) {
  return str.trim().replace(/\s+/g, ' ').replace(/[?:!.,;]+$/, '').toLowerCase();
}

// ─── Tìm câu hỏi trong kho ───────────────────────────────────────────────────
function findEntry(questionText) {
  const q = normalize(questionText);

  // 1. Exact match (question hoặc questionVariants)
  let found = QUIZ_DATA.find(d => {
    if (normalize(d.question) === q) return true;
    return (d.questionVariants || []).some(v => normalize(v) === q);
  });

  // 2. Substring match
  if (!found) {
    found = QUIZ_DATA.find(d => {
      const allQ = [d.question, ...(d.questionVariants || [])];
      return allQ.some(qv => {
        const dq = normalize(qv);
        return q.includes(dq) || dq.includes(q);
      });
    });
  }
  return found || null;
}

function findAnswer(questionText) {
  const entry = findEntry(questionText);
  return entry ? entry.answer : null;
}

// ─── Tìm option khớp đáp án ──────────────────────────────────────────────────
// Ưu tiên: EXACT match trước → tránh chọn nhầm đáp án ngắn khi có đáp án dài hơn
// KHÔNG dùng aNorm.includes(oNorm) vì sẽ chọn nhầm "6.600.000CV" thay vì đáp án đầy đủ
function findMatchingOption(options, questionText) {
  const entry = findEntry(questionText);
  if (!entry) return null;

  const norm = s => s.trim().replace(/\s+/g, ' ').replace(/[?:!.,;]+$/, '').toLowerCase();

  // Tập hợp tất cả variant của đáp án đúng
  const allAnswers = [entry.answer, ...(entry.answerVariants || [])];

  for (const ans of allAnswers) {
    const aNorm = norm(ans);

    // Ưu tiên 1: EXACT match
    const exact = options.find(o => norm(o.text) === aNorm);
    if (exact) return exact;

    // Ưu tiên 2: option text là substring CỦA đáp án
    // (đáp án dài hơn option → vẫn đúng, ví dụ khi web cắt bớt text)
    // Yêu cầu độ dài tối thiểu để tránh match số ngắn như "7" hay "10"
    const sub = options.find(o => {
      const oNorm = norm(o.text);
      return oNorm.length > 15 && aNorm.includes(oNorm);
    });
    if (sub) return sub;
  }
  return null;
}

module.exports = { QUIZ_DATA, findAnswer, findMatchingOption };