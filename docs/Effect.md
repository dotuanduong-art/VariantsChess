
# Effect to Piece
**Note:
Effect không thể dùng lên King
Có thể có nhiều Effect trên cùng 1 quân cờ

-stun:player không thể dùng quân cờ bị stun trong lượt của mình 

-bomb:nếu quân có hiệu ứng bomb bị tiêu diệt,tiêu diệt các quân cờ (nếu có) trong phạm vi 3x3 ô với quân có hiệu ứng bomb làm trung tâm

-Zombie:Ăn quân sẽ không di chuyển sang quân cờ đối phương mà giữ nguyên vị trí, quân bị ăn sẽ dính hiệu ứng Walker
-Walker: Không thể chiếu vua,di chuyển random khi zombie di chuyển, có thể ăn quân ở cả 2 bên

-Fool: Quân dính hiệu ứng này tự động đi 1 ô về phía trước lượt tiếp theo

-Berserk:Quân cờ dính hiệu ứng này nếu không ăn quân trong 2 lượt sẽ bị stun 3 lượt

-Shield: Quân dính hiệu ứng này không thể bị ăn, vẫn có thể bị tiêu diệt bởi hiệu ứng

-Fate: Liên kết 2 quân cùng giá trị với nhau. Nếu 1 quân có fate chết, quân còn lại sẽ chết theo

-Planted:quân có hiệu ứng này có thể biến thành các quân có bậc cao hơn dựa theo số turn tồn tại và sẽ tự động tiến hoá khi ăn quân(ví dụ: tốt có hiệu ứng này được 2 turn khi ăn quân sẽ biến thành mã ,3 turn sẽ thành tượng, 4 turn sẽ thành xe, 5 turn sẽ thành hậu).Noted:Không thể chủ động tiến hoá hay phong hậu khi đến cuối bàn cờ.Hiệu ứng sẽ biến mất khi qua đủ số turn điều kiện(nếu biến thành mã - 2 turn, tượng-3 turn, xe-4 turn, hậu-5 turn).Khi hiệu ứng biến mất quân sẽ về như bình thường

-Death Counter: mỗi lần quân ta chiếu quân địch 1 quân bất kì(trừ vua) sẽ đánh số lên quân địch đó và tăng số lần bị chiếu lên theo số lượng quân chiếu vào, max là 6.Ví dụ: Nếu quân tốt của địch bị xe của ta chiếu vào 1 lần sẽ tính counter là 1, nếu lượt tiếp theo không di chuyển mà vẫn bị chiếu sẽ tính lên 2, nếu quân tốt bị 2 quân chiếu vào trong cùng 1 lượt sẽ +2 trong lượt đó và quân đó không di chuyển sẽ +2 trong lượt tiếp theo

-Bind: Quân có hiệu ứng này sẽ bị hạn chế di chuyển trong ô 5x5 với quân có hiệu ứng làm trung tâm

-Blessing: Nếu quân có hiệu ứng này có hiệu ứng bất lợi, loại bỏ hiệu ứng đó. Nếu quân có hiệu ứng này không có hiệu ứng bất lợi nào, trao shield cho quân đó trong 1 lượt

-Electron: Quân địch ăn quân có hiệu ứng này sẽ bị stun 2 lượt

-Marksman: Quân có hiệu ứng này có thể ăn quân mà không cần di chuyển

-Aegis: quân có hiệu ứng này sẽ miễn nhiễm hiệu ứng bất lợi

-Ghost: Quân có hiệu ứng này có thể đi xuyên tối đa 1 quân cờ khác 

# Effect to Board
-repel:Quân địch đi vào ô có hiệu ứng này sẽ bị đẩy lùi về vị trí xuất phát(ví dụ: đặt hiệu ứng này ở a4, quân địch đi từ a1 đến a4 sẽ bị đẩy lùi về a1). Trường hợp nếu ô bị đẩy về có quân khác thì quân chiếm ô đó sẽ tạm biến mất nhường ô cho quân bị đẩy về, chỉ khi ô đó trống thì mới hiện lại

-souless:Quân địch đi vào ô này sẽ bị vô hiệu hoá(không thể chọn để di chuyển quân).Chỉ có thể gỡ bỏ hiệu ứng này bằng cách dùng 1 quân khác di chuyển vào vị trí quân cờ này đã đi trước đó(ví dụ: hiệu ứng này ở a4, quân địch đi từ a1 đến a4 sẽ bị vô hiệu hoá, cần 1 quân địch khác đi vào a1 để gỡ bỏ hiệu ứng này)

-flame: Các ô có hiệu ứng này sẽ không thể di chuyển các quân vào

-Mountain: quân 2 bên sẽ không thể đi vào ô có hiệu ứng này, không thể đi qua hay chiếu xuyên qua ô có hiệu ứng này 

-Outworld: Chỉ quân của Space mới có thể di chuyển lên, quân địch không thể đi vào ô có hiệu ứng này. 

-Dimension: Quân địch đi qua ô Dimension lẻ sẽ bị dịch chuyển về ô Dimension chẵn cặp với ô lẻ đó. Quân đồng minh đi vào ô lẻ sẽ dịch chuyển sang ô chẵn nếu đứng ở trên ô đó trong 1 lượt. note: đi qua không phải đi vào. Khi có quân địch đi qua, ô mất Dimension ở lượt tiếp theo